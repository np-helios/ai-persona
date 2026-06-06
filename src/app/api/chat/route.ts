import { NextResponse } from "next/server";
import { answerWithTools, incomingMessageSchema } from "@/lib/chat";

export async function POST(request: Request) {
  try {
    const body = incomingMessageSchema.parse(await request.json());
    const answer = await answerWithTools(body);
    return NextResponse.json(answer);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
