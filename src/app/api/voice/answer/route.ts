import { NextResponse } from "next/server";
import { answerWithTools } from "@/lib/chat";

async function answerQuestion(question: string) {
  const trimmed = question.trim();

  if (!trimmed) {
    return NextResponse.json(
      { error: "Missing required parameter: question" },
      { status: 400 }
    );
  }

  const answer = await answerWithTools({
    messages: [{ role: "user", content: trimmed }]
  });

  return NextResponse.json({
    answer: answer.content,
    result: answer.content,
    text: answer.content,
    sources: answer.sources ?? []
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const question = (
      url.searchParams.get("question") ??
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      ""
    ).trim();

    return answerQuestion(question);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = String(
      body.question ?? body.q ?? body.query ?? body.prompt ?? ""
    );

    return answerQuestion(question);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
