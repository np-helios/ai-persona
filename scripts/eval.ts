import fs from "node:fs/promises";
import path from "node:path";
import "./load-env";
import { answerWithTools } from "../src/lib/chat";

const goldenPath = path.join(process.cwd(), "evals", "golden.json");
const outPath = path.join(process.cwd(), "data", "eval-results.json");

type Golden = {
  question: string;
  mustMention?: string[];
  mustNotMention?: string[];
  expectedSources?: string[];
  category?: "resume" | "github" | "adversarial" | "calendar";
};

function includesAll(answer: string, terms: string[] = []) {
  const lower = answer.toLowerCase();
  return terms.every((term) => lower.includes(term.toLowerCase()));
}

function excludesAll(answer: string, terms: string[] = []) {
  const lower = answer.toLowerCase();
  return terms.every((term) => !lower.includes(term.toLowerCase()));
}

function sourceRecall(actual: string[], expected: string[] = []) {
  if (expected.length === 0) return null;
  const lowerActual = actual.map((source) => source.toLowerCase());
  const hits = expected.filter((source) =>
    lowerActual.some((actualSource) => actualSource.includes(source.toLowerCase()))
  );
  return hits.length / expected.length;
}

async function main() {
  const goldens = JSON.parse(await fs.readFile(goldenPath, "utf8")) as Golden[];
  const results = [];

  for (const item of goldens) {
    const started = Date.now();
    const response = await answerWithTools({
      messages: [{ role: "user", content: item.question }]
    });
    const latencyMs = Date.now() - started;
    const actualSources = response.sources.map((source) => source.source);
    const grounded =
      includesAll(response.content, item.mustMention) &&
      excludesAll(response.content, item.mustNotMention);
    const recall = sourceRecall(actualSources, item.expectedSources);
    results.push({
      category: item.category ?? "resume",
      question: item.question,
      answer: response.content,
      sources: response.sources,
      latencyMs,
      grounded,
      sourceRecall: recall
    });
  }

  const groundedCount = results.filter((result) => result.grounded).length;
  const recalls = results
    .map((result) => result.sourceRecall)
    .filter((value): value is number => typeof value === "number");
  const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const percentile = (p: number) =>
    latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))] ??
    0;

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        count: results.length,
        groundedPassRate: groundedCount / Math.max(results.length, 1),
        hallucinationRate: 1 - groundedCount / Math.max(results.length, 1),
        retrievalRecall:
          recalls.length > 0
            ? recalls.reduce((sum, value) => sum + value, 0) / recalls.length
            : null,
        latencyMs: {
          p50: percentile(0.5),
          p95: percentile(0.95)
        },
        results
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
