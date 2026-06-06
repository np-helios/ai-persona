import { google } from "googleapis";
import { addDays, addMinutes, isWeekend, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { z } from "zod";
import { config, requireEnv } from "./config";

const bookingSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  start: z.string().datetime().optional(),
  slotLabel: z.string().optional(),
  localDate: z.string().optional(),
  localStartTime: z.string().optional(),
  timezone: z.string().default(config.timezone),
  notes: z.string().optional()
});

export type BookingRequest = z.infer<typeof bookingSchema>;

export type AvailabilitySlot = {
  start: string;
  end: string;
  timezone: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  label: string;
};

export function calendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      ((process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ||
        (process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REFRESH_TOKEN))
  );
}

function calendarClient() {
  if (!calendarConfigured()) {
    throw new Error(
      "Calendar booking is not configured yet. Add either Google OAuth credentials or service account credentials to .env.local."
    );
  }

  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return {
      calendar: google.calendar({ version: "v3", auth }),
      canInviteAttendees: true
    };
  }

  const privateKey = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });
  return {
    calendar: google.calendar({ version: "v3", auth }),
    canInviteAttendees: false
  };
}

function slotUtc(day: Date, hour: number, minute: number) {
  const zoned = toZonedTime(day, config.timezone);
  zoned.setHours(hour, minute, 0, 0);
  return fromZonedTime(zoned, config.timezone);
}

function formatLocal(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: config.timezone,
    ...options
  }).format(date);
}

function availabilitySlot(start: Date, end: Date): AvailabilitySlot {
  const localDate = formatLocal(start, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const localStartTime = formatLocal(start, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const localEndTime = formatLocal(end, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: config.timezone,
    localDate,
    localStartTime,
    localEndTime,
    label: `${localDate}, ${localStartTime} - ${localEndTime} ${config.timezone}`
  };
}

export async function getAvailability() {
  const { calendar } = calendarClient();
  const now = new Date();
  const windowEnd = addDays(now, config.lookaheadDays);

  const busy = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: windowEnd.toISOString(),
      items: [{ id: config.calendarId }]
    }
  });

  const busyRanges =
    busy.data.calendars?.[config.calendarId]?.busy?.map((range) => ({
      start: new Date(range.start ?? ""),
      end: new Date(range.end ?? "")
    })) ?? [];

  const slots: AvailabilitySlot[] = [];
  for (let offset = 0; offset < config.lookaheadDays; offset += 1) {
    const day = addDays(startOfDay(now), offset);
    if (isWeekend(toZonedTime(day, config.timezone))) continue;

    for (let hour = config.workdayStart; hour < config.workdayEnd; hour += 1) {
      for (let minute = 0; minute < 60; minute += config.slotMinutes) {
        const start = slotUtc(day, hour, minute);
        const end = addMinutes(start, config.slotMinutes);
        if (start <= now) continue;
        const overlaps = busyRanges.some(
          (range) => start < range.end && end > range.start
        );
        if (!overlaps) {
          slots.push(availabilitySlot(start, end));
        }
        if (slots.length >= 12) return slots;
      }
    }
  }
  return slots;
}

export async function bookInterview(input: BookingRequest) {
  const parsed = bookingSchema.parse(input);
  const { calendar, canInviteAttendees } = calendarClient();
  const start = parsed.start
    ? new Date(parsed.start)
    : await resolveRequestedSlot(parsed);
  const end = addMinutes(start, config.slotMinutes);

  const free = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: config.calendarId }]
    }
  });
  const busy = free.data.calendars?.[config.calendarId]?.busy ?? [];
  if (busy.length > 0) {
    return { booked: false, reason: "That slot is no longer available." };
  }

  const event = await calendar.events.insert({
    calendarId: config.calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: `Scaler interview with ${parsed.name}`,
      description: [
        parsed.notes ?? "Booked by AI persona.",
        canInviteAttendees
          ? ""
          : `Attendee to invite manually if using service-account fallback: ${parsed.name} <${parsed.email}>`
      ]
        .filter(Boolean)
        .join("\n\n"),
      start: { dateTime: start.toISOString(), timeZone: parsed.timezone },
      end: { dateTime: end.toISOString(), timeZone: parsed.timezone },
      attendees: canInviteAttendees
        ? [
            { email: parsed.email, displayName: parsed.name },
            ...(config.personaEmail ? [{ email: config.personaEmail }] : [])
          ]
        : undefined,
      conferenceData: {
        createRequest: {
          requestId: `persona-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    }
  });

  return {
    booked: true,
    eventId: event.data.id,
    htmlLink: event.data.htmlLink,
    meetLink: event.data.hangoutLink,
    attendeeInviteSent: canInviteAttendees,
    warning: canInviteAttendees
      ? undefined
      : "Event was created, but attendee invite was not sent because service accounts cannot invite attendees on personal Gmail calendars. Use Google OAuth credentials for full no-human-loop invites.",
    start: start.toISOString(),
    end: end.toISOString()
  };
}

async function resolveRequestedSlot(
  parsed: Omit<BookingRequest, "start"> & { start?: string }
) {
  const slots = await getAvailability();
  const requested = [
    parsed.slotLabel,
    parsed.localDate,
    parsed.localStartTime
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const exact = slots.find((slot) => {
    const haystack = [
      slot.label,
      slot.localDate,
      slot.localStartTime,
      slot.localEndTime
    ]
      .join(" ")
      .toLowerCase();
    return (
      haystack.includes(requested) ||
      (parsed.localStartTime &&
        haystack.includes(parsed.localStartTime.toLowerCase()) &&
        (!parsed.localDate || haystack.includes(parsed.localDate.toLowerCase())))
    );
  });

  if (!exact) {
    throw new Error(
      "I could not match that requested time to an available slot. Please choose one of the listed slot labels."
    );
  }

  return new Date(exact.start);
}
