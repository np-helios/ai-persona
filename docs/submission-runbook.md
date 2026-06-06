# Submission Runbook

Use this as the final setup checklist after chat/RAG works locally.

## 1. Local Sanity Check

```bash
npm run check:setup
npm run dev
```

Open `http://localhost:3000/api/setup-status`. It returns booleans only, never secrets.

Expected before submission:

- `openai: true`
- `ragIndex: true`
- `githubCorpusFiles: 12` or more
- `calendar: true`
- `publicBaseUrl`: deployed HTTPS URL

## 2. Google Calendar Booking

Create a Google Cloud project and enable Google Calendar API.

For personal Gmail calendars, use OAuth credentials for final submission. Service
accounts can read/create events on a shared personal calendar, but Google does
not allow them to invite attendees without Google Workspace domain-wide
delegation.

Set these for final booking:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=
```

You may keep service-account variables locally for availability tests, but OAuth
is the path that sends real attendee invites.

Create a service account:

1. Google Cloud Console -> IAM & Admin -> Service Accounts.
2. Create service account.
3. Open the service account -> Keys -> Add key -> JSON.
4. Copy `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
5. Copy `private_key` into `GOOGLE_PRIVATE_KEY`.

Important: keep the private key on one line in `.env.local` with escaped newlines:

```env
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Share your Google Calendar with the service account email:

1. Google Calendar -> Settings -> your calendar.
2. Share with specific people.
3. Add the service account email.
4. Permission: **Make changes to events**.

For `GOOGLE_CALENDAR_ID`, use `primary` for local testing if it works. If not, use the actual calendar ID from Google Calendar settings.

Test:

```bash
curl http://localhost:3000/api/availability
npm run test:oauth
npm run test:calendar
```

Then ask chat: `Show me available interview slots.`

## 3. Vercel Deployment

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add environment variables from `.env.local`.
4. Change `PUBLIC_BASE_URL` to the deployed URL, for example:

```env
PUBLIC_BASE_URL=https://your-app.vercel.app
```

The build fetches GitHub, ingests the corpus, and then runs `next build`, so Vercel must have `OPENAI_API_KEY` and `GITHUB_USERNAME`.

After deployment, test:

```txt
https://your-app.vercel.app/api/setup-status
https://your-app.vercel.app/api/availability
```

## 4. Voice Agent With Vapi

Create a Vapi assistant:

- First message: `Hi, I’m Nishtha Pandey’s AI representative. I can answer questions about her background and help book an interview.`
- System prompt endpoint: `https://your-app.vercel.app/api/voice/system-prompt`
- Tool webhook: `https://your-app.vercel.app/api/vapi/tool`
- Header: `x-vapi-secret: same value as VAPI_SECRET`

Create three tools using `docs/vapi-tools.json`:

- `answer_question`
- `get_availability`
- `book_interview`

Recommended voice settings:

- Barge-in/interruption: enabled
- Endpointing: 300-500 ms
- Max silence before response: low
- Keep responses concise

Buy/connect a phone number in Vapi. That phone number is the Part A submission.

Vapi expects tool responses in this shape:

```json
{
  "results": [
    {
      "toolCallId": "call-id-from-vapi",
      "result": "tool result"
    }
  ]
}
```

The `/api/vapi/tool` route returns that format and supports multiple tool calls in one webhook.

## 5. Evals

Run:

```bash
npm run eval
```

For voice, make at least 10 calls:

- 3 background/skills questions
- 2 GitHub project questions
- 2 prompt-injection attempts
- 3 booking attempts, including one interruption

Fill `docs/eval-report.html`, print/export it as PDF, and submit that PDF.

## 6. Loom

Use `docs/loom-outline.md`. Keep it under 3 minutes:

- Show chat grounded answer
- Show adversarial refusal
- Show booking
- Explain RAG + calendar + voice architecture
- Mention one hard problem and fix
