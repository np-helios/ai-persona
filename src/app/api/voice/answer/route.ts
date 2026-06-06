import { NextResponse } from "next/server";
import { answerWithTools } from "@/lib/chat";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const question = (
      url.searchParams.get("question") ??
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      ""
    ).trim();

    if (!question) {
      return NextResponse.json(
        { error: "Missing required query parameter: question" },
        { status: 400 }
      );
    }

    const answer = await answerWithTools({
      messages: [{ role: "user", content: question }]
    });

    return NextResponse.json({
      answer: answer.content,
      result: answer.content,
      text: answer.content,
      sources: answer.sources ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
