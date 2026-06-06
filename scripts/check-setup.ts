import fs from "node:fs";
import path from "node:path";
import "./load-env";
import { calendarConfigured } from "../src/lib/calendar";

function status(label: string, ok: boolean, detail = "") {
  const mark = ok ? "OK" : "MISSING";
  console.log(`${mark.padEnd(8)} ${label}${detail ? ` - ${detail}` : ""}`);
}

const root = process.cwd();
const envLocal = fs.existsSync(path.join(root, ".env.local"));
const indexPath = path.join(root, "data", "index.json");
const githubDir = path.join(root, "corpus", "github");
const githubCount = fs.existsSync(githubDir)
  ? fs.readdirSync(githubDir).filter((file) => file.endsWith(".md")).length
  : 0;

status(".env.local", envLocal);
status("OPENAI_API_KEY", Boolean(process.env.OPENAI_API_KEY));
status("PERSONA_EMAIL", Boolean(process.env.PERSONA_EMAIL));
status("GITHUB_USERNAME", Boolean(process.env.GITHUB_USERNAME), process.env.GITHUB_USERNAME || "defaults to np-helios");
status("GitHub corpus", githubCount > 0, `${githubCount} repo files`);
status("RAG index", fs.existsSync(indexPath));
status("Google Calendar", calendarConfigured());
status("VAPI_SECRET", Boolean(process.env.VAPI_SECRET), "optional but recommended");
status("PUBLIC_BASE_URL", Boolean(process.env.PUBLIC_BASE_URL), process.env.PUBLIC_BASE_URL);

if (!calendarConfigured()) {
  console.log(
    "\nCalendar needs GOOGLE_CALENDAR_ID plus either GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY."
  );
}
