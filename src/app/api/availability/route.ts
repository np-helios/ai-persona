import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/calendar";

export async function GET() {
  try {
    return NextResponse.json({ slots: await getAvailability() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
