"use client";

import { CalendarDays, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; source: string; score: number }[];
};

const starters = [
  "Why is Nishtha the right person for this AI Engineer role?",
  "What GitHub projects should I ask her about?",
  "Show me available interview slots.",
  "What should I know from her resume?"
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m Nishtha Pandey's AI representative. I can answer grounded questions about her resume and GitHub work, and I can help book an interview from her real calendar availability."
    }
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const initials = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_PERSONA_INITIALS || "NP").slice(0, 2).toUpperCase(),
    []
  );

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content }))
        })
      });
      const data = await response.json();
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.content ?? data.error ?? "No response.",
          sources: data.sources
        }
      ]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `I hit a runtime error: ${
            error instanceof Error ? error.message : "unknown error"
          }`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">{initials}</div>
          <div>
            <h1>AI Persona</h1>
            <div className="meta">Grounded hiring representative</div>
          </div>
        </div>

        <p>
          Ask about resume evidence, public GitHub work, design tradeoffs, role fit,
          or interview availability. Answers cite the indexed corpus and refuse
          unsupported claims.
        </p>

        <section>
          <h2>Live Capabilities</h2>
          <p>
            <ShieldCheck size={16} /> RAG-grounded chat
          </p>
          <p>
            <CalendarDays size={16} /> Real calendar booking
          </p>
        </section>

        <section>
          <h2>Submission</h2>
          <p>
            Use this URL for Part B after deployment. Use the Vapi/Twilio phone
            number configured against the voice endpoints for Part A.
          </p>
        </section>
      </aside>

      <section className="main">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`}>
              <div className={`message ${message.role}`}>{message.content}</div>
              {message.sources && message.sources.length > 0 ? (
                <div className="sources">
                  {message.sources.map((source) => (
                    <span className="source" key={`${source.title}-${source.source}`}>
                      {source.title} · {source.score}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="composer">
          <div className="quick">
            {starters.map((starter) => (
              <button
                className="secondary"
                type="button"
                key={starter}
                onClick={() => void send(starter)}
                disabled={loading}
              >
                {starter}
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a probing hiring question..."
              aria-label="Message"
            />
            <button type="submit" disabled={loading}>
              <Send size={18} aria-hidden="true" /> {loading ? "Thinking" : "Send"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
