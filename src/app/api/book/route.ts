import { NextResponse } from "next/server";
import { bookInterview } from "@/lib/calendar";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await bookInterview(await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
