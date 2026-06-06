import { NextResponse } from "next/server";
import { bookInterview, getAvailability } from "@/lib/calendar";
import { answerWithTools } from "@/lib/chat";

function authorized(request: Request) {
  const expected = process.env.VAPI_SECRET;
  if (!expected) return true;
  const got = request.headers.get("x-vapi-secret");
  return got === expected;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const calls = normalizeToolCalls(body);
    if (calls.length === 0) {
      return NextResponse.json({ error: "No tool calls found" }, { status: 400 });
    }

    const results = [];
    for (const call of calls) {
      results.push({
        name: call.name,
        toolCallId: call.id,
        result: await runTool(call.name, call.args)
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

type NormalizedToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

function normalizeToolCalls(body: any): NormalizedToolCall[] {
  const list =
    body?.message?.toolCallList ??
    body?.message?.toolWithToolCallList?.map((item: any) => ({
      id: item?.toolCall?.id,
      name: item?.name,
      parameters: item?.toolCall?.parameters
    })) ??
    body?.toolCallList;

  if (Array.isArray(list)) {
    return list.map((call, index) => ({
      id: String(call.id ?? call.toolCallId ?? `call-${index}`),
      name: String(call.name ?? ""),
      args: call.arguments ?? call.parameters ?? {}
    }));
  }

  if (body?.name) {
    return [
      {
        id: String(body.id ?? body.toolCallId ?? "call-0"),
        name: String(body.name),
        args: body.arguments ?? body.parameters ?? {}
      }
    ];
  }

  return [];
}

async function runTool(name: string, args: Record<string, unknown>) {
  try {
    if (name === "get_availability") {
      const slots = await getAvailability();
      return JSON.stringify({ slots });
    }

    if (name === "book_interview") {
      return JSON.stringify(await bookInterview(args as any));
    }

    if (name === "answer_question") {
      const question = String(args.question ?? "");
      const answer = await answerWithTools({
        messages: [{ role: "user", content: question }]
      });
      return answer.content;
    }

    return `Unknown tool: ${name}`;
  } catch (error) {
    return error instanceof Error ? error.message : "Tool call failed.";
  }
}
