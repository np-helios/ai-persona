import fs from "node:fs/promises";
import path from "node:path";
import "./load-env";
import { openai, models } from "../src/lib/openai";
import type { SourceChunk } from "../src/lib/rag";

const corpusDir = path.join(process.cwd(), "corpus");
const outDir = path.join(process.cwd(), "data");
const outFile = path.join(outDir, "index.json");

const allowed = new Set([".md", ".txt", ".json"]);

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (allowed.has(path.extname(entry.name))) return [full];
      return [];
    })
  );
  return files.flat();
}

function chunksForFile(file: string, text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > 1400) {
      if (current) chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((chunk, index) => ({
    id: `${path.relative(corpusDir, file)}#${index + 1}`,
    title: path.relative(corpusDir, file),
    source: path.relative(process.cwd(), file),
    text: chunk
  }));
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const files = await walk(corpusDir);
  const rawChunks = (
    await Promise.all(
      files.map(async (file) => chunksForFile(file, await fs.readFile(file, "utf8")))
    )
  ).flat();

  if (rawChunks.length === 0) {
    throw new Error("No corpus chunks found. Add resume and GitHub files first.");
  }

  const embedded: SourceChunk[] = [];
  for (const chunk of rawChunks) {
    const response = await openai().embeddings.create({
      model: models.embed,
      input: chunk.text
    });
    embedded.push({
      ...chunk,
      embedding: response.data[0]?.embedding ?? []
    });
  }

  await fs.writeFile(outFile, JSON.stringify(embedded, null, 2));
  console.log(`Indexed ${embedded.length} chunks from ${files.length} files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
