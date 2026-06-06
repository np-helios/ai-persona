import { NextResponse } from "next/server";
import { systemPrompt } from "@/lib/persona";
import { retrieve } from "@/lib/rag";

export async function GET() {
  const chunks = await retrieve("summary of resume github projects role fit", 10);
  return NextResponse.json({
    firstMessage:
      "Hi, I’m Nishtha Pandey’s AI representative. I can answer questions about her background and help book an interview.",
    systemPrompt: systemPrompt(chunks)
  });
}
