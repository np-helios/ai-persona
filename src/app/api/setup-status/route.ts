import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { calendarConfigured } from "@/lib/calendar";

function present(name: string) {
  return Boolean(process.env[name]);
}

export async function GET() {
  const indexPath = path.join(process.cwd(), "data", "index.json");
  const corpusPath = path.join(process.cwd(), "corpus", "github");

  return NextResponse.json({
    openai: present("OPENAI_API_KEY"),
    personaEmail: present("PERSONA_EMAIL"),
    githubUsername: process.env.GITHUB_USERNAME || null,
    ragIndex: fs.existsSync(indexPath),
    githubCorpusFiles: fs.existsSync(corpusPath)
      ? fs.readdirSync(corpusPath).filter((file) => file.endsWith(".md")).length
      : 0,
    calendar: calendarConfigured(),
    voiceSecret: present("VAPI_SECRET"),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null
  });
}
