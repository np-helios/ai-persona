import fs from "node:fs/promises";
import path from "node:path";
import "./load-env";

const username = process.env.GITHUB_USERNAME || "np-helios";
const token = process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  "User-Agent": "ai-persona-ingest"
};
if (token) headers.Authorization = `Bearer ${token}`;

async function gh<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

type Repo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string;
};

type Commit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { date: string };
  };
};

async function maybeReadme(repo: Repo) {
  const response = await fetch(
    `https://api.github.com/repos/${repo.full_name}/readme`,
    { headers }
  );
  if (!response.ok) return "";
  const data = (await response.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return "";
  return Buffer.from(data.content, "base64").toString("utf8");
}

async function main() {
  const repos = await gh<Repo[]>(
    `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`
  );
  const selected = repos
    .filter((repo) => !repo.fork && !repo.archived)
    .slice(0, Number(process.env.GITHUB_REPO_LIMIT ?? 12));

  const outDir = path.join(process.cwd(), "corpus", "github");
  await fs.mkdir(outDir, { recursive: true });

  for (const repo of selected) {
    const commits = await gh<Commit[]>(
      `https://api.github.com/repos/${repo.full_name}/commits?per_page=20`
    ).catch(() => []);
    const readme = await maybeReadme(repo);
    const body = [
      `# ${repo.full_name}`,
      `URL: ${repo.html_url}`,
      `Description: ${repo.description ?? "No public description."}`,
      `Primary language: ${repo.language ?? "Unknown"}`,
      `Topics: ${repo.topics?.join(", ") || "None"}`,
      `Last pushed: ${repo.pushed_at}`,
      "",
      "## README",
      readme || "No README found.",
      "",
      "## Recent commit history",
      ...commits.map(
        (commit) =>
          `- ${commit.sha.slice(0, 7)} (${commit.commit.author.date}) ${
            commit.commit.message
          } ${commit.html_url}`
      )
    ].join("\n");

    await fs.writeFile(path.join(outDir, `${repo.name}.md`), body);
  }

  console.log(`Fetched ${selected.length} repositories into corpus/github.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
