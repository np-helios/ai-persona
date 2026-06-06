export const config = {
  personaName: process.env.PERSONA_NAME ?? "Nishtha Pandey",
  personaEmail: process.env.PERSONA_EMAIL ?? "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  timezone: process.env.BOOKING_TIMEZONE ?? "Asia/Kolkata",
  workdayStart: Number(process.env.BOOKING_WORKDAY_START ?? "10"),
  workdayEnd: Number(process.env.BOOKING_WORKDAY_END ?? "18"),
  slotMinutes: Number(process.env.BOOKING_SLOT_MINUTES ?? "30"),
  lookaheadDays: Number(process.env.BOOKING_LOOKAHEAD_DAYS ?? "10"),
  calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary"
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
