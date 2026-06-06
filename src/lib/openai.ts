import OpenAI from "openai";
import { requireEnv } from "./config";

let client: OpenAI | undefined;

export function openai() {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}

export const models = {
  chat: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
  embed: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small"
};
