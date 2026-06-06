import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import { bookInterview, getAvailability, type AvailabilitySlot } from "./calendar";
import { openai, models } from "./openai";
import { systemPrompt } from "./persona";
import { publicSources, retrieve } from "./rag";

export const incomingMessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })
    )
    .min(1)
});

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_availability",
      description: "Return open interview slots from the real calendar.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "book_interview",
      description: "Book a confirmed interview on the real calendar.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          start: {
            type: "string",
            description:
              "Exact ISO datetime from an availability slot, if available"
          },
          slotLabel: {
            type: "string",
            description:
              "Human-readable slot label from availability, such as 'Mon, 8 Jun, 2026, 10:00 am - 10:30 am Asia/Kolkata'"
          },
          localDate: {
            type: "string",
            description: "Local date if the user selected a natural-language slot"
          },
          localStartTime: {
            type: "string",
            description: "Local start time if the user selected a natural-language slot"
          },
          timezone: { type: "string" },
          notes: { type: "string" }
        },
        required: ["name", "email", "timezone"],
        additionalProperties: false
      }
    }
  }
];

export async function answerWithTools(input: z.infer<typeof incomingMessageSchema>) {
  const latestUser =
    [...input.messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";

  const calendarFastPath = await maybeHandleCalendarFastPath(input.messages, latestUser);
  if (calendarFastPath) return calendarFastPath;

  const chunks = await retrieve(latestUser);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(chunks) },
    ...input.messages.map((message) => ({
      role: message.role,
      content: message.content
    }))
  ];

  const first = await openai().chat.completions.create({
    model: models.chat,
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.2
  });

  const message = first.choices[0]?.message;
  if (!message?.tool_calls?.length) {
    return {
      content: message?.content ?? "I could not generate a grounded answer.",
      sources: publicSources(chunks)
    };
  }

  messages.push(message);
  let usedCalendarTool = false;
  for (const call of message.tool_calls) {
    if (call.type !== "function") continue;
    let result: unknown;
    try {
      if (call.function.name === "get_availability") {
        usedCalendarTool = true;
        result = await getAvailability();
      } else if (call.function.name === "book_interview") {
        usedCalendarTool = true;
        result = await bookInterview(JSON.parse(call.function.arguments));
      } else {
        result = { error: "Unknown tool" };
      }
    } catch (error) {
      result = {
        error: error instanceof Error ? error.message : "Tool call failed."
      };
    }
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result)
    });
  }

  const final = await openai().chat.completions.create({
    model: models.chat,
    messages,
    temperature: 0.2
  });

  return {
    content:
      final.choices[0]?.message.content ??
      "I completed the tool call but could not summarize it.",
    sources: usedCalendarTool ? [] : publicSources(chunks)
  };
}

async function maybeHandleCalendarFastPath(
  messages: z.infer<typeof incomingMessageSchema>["messages"],
  message: string
) {
  const text = message.toLowerCase();
  const recentText = messages
    .slice(-6)
    .map((item) => item.content)
    .join("\n")
    .toLowerCase();
  const asksAvailability =
    /\b(available|availability|slots?|free|schedule)\b/.test(text) &&
    /\b(interview|call|meet|meeting|slots?|available|availability)\b/.test(text);
  const asksBooking = /\b(book|schedule|confirm|reserve)\b/.test(text);
  const continuesBooking =
    /\b(email|name|recruiter|interviewer)\b/.test(text) ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message);
  const bookingContext =
    asksBooking ||
    (continuesBooking &&
      /\b(book|schedule|confirm|reserve|slot|interview)\b/.test(recentText));

  if (asksAvailability && !bookingContext) {
    const slots = await getAvailability();
    return {
      content: formatAvailability(slots),
      sources: []
    };
  }

  if (bookingContext) {
    const slots = await getAvailability();
    const conversation = bookingConversation(messages);
    const email = conversation.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const name = extractName(conversation);
    const slot = findRequestedSlot(conversation, slots);

    const missing = [];
    if (!slot) missing.push("which slot you want");
    if (!name) missing.push("the recruiter's name");
    if (!email) missing.push("the recruiter's email");

    if (missing.length > 0 || !slot || !name || !email) {
      const prompt =
        missing.length === 1
          ? `Please send ${missing[0]}.`
          : `Please send ${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}.`;
      return {
        content: `I can book that. ${prompt}`,
        sources: []
      };
    }

    const result = await bookInterview({
      name,
      email,
      start: slot.start,
      timezone: slot.timezone,
      notes: "Booked from AI persona chat."
    });

    if (!result.booked) {
      return {
        content: result.reason ?? "That slot is no longer available.",
        sources: []
      };
    }

    return {
      content: `Booked. The interview is confirmed for ${slot.label}.${result.meetLink ? ` Google Meet: ${result.meetLink}` : ""}`,
      sources: []
    };
  }

  return null;
}

function formatAvailability(slots: AvailabilitySlot[]) {
  if (slots.length === 0) {
    return "I do not see any open interview slots in the configured booking window.";
  }

  const lines = slots.slice(0, 8).map((slot) => `- ${slot.label}`);
  return `Here are the next available interview slots:\n\n${lines.join(
    "\n"
  )}\n\nReply with a slot, name, and email to book it.`;
}

function extractName(message: string) {
  const patterns = [
    /\bfor\s+(.+?)\s+at\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\bwith\s+(.+?)\s+at\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\bwith\s+(.+?)(?:,|\n|$)/i,
    /\brecruiter\s+is\s+(.+?)(?:\s+and\s+email|\s+and\s+the\s+email|,|\n|$)/i,
    /\binterviewer\s+is\s+(.+?)(?:\s+and\s+email|\s+and\s+the\s+email|,|\n|$)/i,
    /\bname\s+is\s+(.+?)(?:,|\n|$)/i,
    /\brecruiter(?:'s)?\s+name\s+is\s+(.+?)(?:,|\n|$)/i,
    /\binterviewer(?:'s)?\s+name\s+is\s+(.+?)(?:,|\n|$)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return cleanName(match[1]);
  }

  return "";
}

function bookingConversation(
  messages: z.infer<typeof incomingMessageSchema>["messages"]
) {
  const recent = messages.slice(-10);
  let start = 0;
  for (let index = recent.length - 2; index >= 0; index -= 1) {
    const content = recent[index].content.toLowerCase();
    if (
      recent[index].role === "assistant" &&
      /\bbooked\b/.test(content) &&
      /\bconfirmed\b/.test(content)
    ) {
      start = index + 1;
      break;
    }
  }

  return recent
    .slice(start)
    .map((item) => item.content)
    .join("\n");
}

function cleanName(value: string) {
  return value
    .replace(/\bat\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}.*/i, "")
    .replace(/\bemail\s+is\b.*/i, "")
    .trim()
    .replace(/[.,]$/, "");
}

function findRequestedSlot(message: string, slots: AvailabilitySlot[]) {
  const normalized = normalize(message);
  const requested = parseRequestedSlot(message);
  return (
    slots.find((slot) => normalized.includes(normalize(slot.label))) ??
    slots.find(
      (slot) =>
        normalized.includes(normalize(slot.localStartTime)) &&
        normalized.includes(normalize(slot.localDate))
    ) ??
    slots.find(
      (slot) =>
        requested &&
        slot.localDate.includes(` ${requested.day} `) &&
        normalize(slot.localStartTime) === normalize(requested.startTime) &&
        (!requested.endTime ||
          normalize(slot.localEndTime) === normalize(requested.endTime))
    ) ??
    slots.find((slot) => normalized.includes(normalize(slot.localStartTime)))
  );
}

function parseRequestedSlot(message: string) {
  const dayMatch = message.match(
    /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)?\s*,?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  const timeMatch = message.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  );

  if (!dayMatch || !timeMatch) return null;

  const endPeriod = timeMatch[6].toLowerCase();
  const startPeriod = (timeMatch[3] ?? endPeriod).toLowerCase();
  const startTime = `${Number(timeMatch[1])}:${timeMatch[2] ?? "00"} ${startPeriod}`;
  const endTime = `${Number(timeMatch[4])}:${timeMatch[5] ?? "00"} ${endPeriod}`;

  return {
    day: Number(dayMatch[1]),
    startTime,
    endTime
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}
