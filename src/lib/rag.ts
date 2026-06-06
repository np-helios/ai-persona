import fs from "node:fs/promises";
import path from "node:path";
import { openai, models } from "./openai";

export type SourceChunk = {
  id: string;
  title: string;
  source: string;
  text: string;
  embedding: number[];
};

export type RetrievedChunk = SourceChunk & { score: number };

const indexPath = path.join(process.cwd(), "data", "index.json");
let indexCache: SourceChunk[] | undefined;

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function loadIndex(): Promise<SourceChunk[]> {
  if (indexCache) return indexCache;
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    indexCache = JSON.parse(raw) as SourceChunk[];
    return indexCache;
  } catch {
    return [];
  }
}

export async function retrieve(query: string, k = 8): Promise<RetrievedChunk[]> {
  const chunks = await loadIndex();
  if (chunks.length === 0) return [];

  const embedding = await openai().embeddings.create({
    model: models.embed,
    input: query
  });
  const vector = embedding.data[0]?.embedding ?? [];

  return chunks
    .map((chunk) => ({ ...chunk, score: cosine(vector, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function buildContext(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.title}\nSource: ${chunk.source}\n${chunk.text}`
    )
    .join("\n\n");
}

export function publicSources(chunks: RetrievedChunk[]) {
  const seen = new Set<string>();
  return chunks
    .filter((chunk) => {
      const key = `${chunk.title}|${chunk.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((chunk) => ({
      title: chunk.title,
      source: chunk.source,
      score: Number(chunk.score.toFixed(3))
    }));
}
