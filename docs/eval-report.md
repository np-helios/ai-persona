# AI Persona Eval Report

**Voice quality.** Tested 6 Vapi Talk/PSTN-style calls covering intro, profile Q&A, GitHub Q&A, availability, booking, interruptions, and email confirmation. First-response latency was measured from Vapi's live latency panel and transcript timing; observed steady-state latency was ~840ms after switching to GPT-4o mini, Deepgram Nova 3 English (India), and concise prompts. Transcription accuracy was manually labelled on 30 utterances with names, email spelling, slots, and interruptions; approximate word accuracy: 87%. Booking task completion: 4/5 attempts successfully checked Google Calendar, proposed slots, created an event, and produced a Meet link.

**Chat groundedness.** Built a golden set of 5 questions across resume, GitHub READMEs, design tradeoffs, adversarial prompt injections, and unknown facts. Hallucination rate was measured by manual labels plus a judge pass requiring factual claims to be supported by retrieved chunks; hallucination rate: 0%. Retrieval quality was measured by checking whether expected source files appeared in top-5 chunks; precision@5: 0.80, recall@5: 1.00. Chat latency from the eval run was p50 2766ms and p95 5158ms.

**Failure modes and fixes.** (1) Service-account calendar invites failed because Google blocks attendee invites without domain-wide delegation; fixed by switching to OAuth refresh-token booking. (2) Vapi tools returned unauthorized/missing-parameter errors because GET/POST schemas and response mappings differed from chat endpoints; fixed with dedicated voice endpoints and explicit tool schemas. (3) Voice transcription mangled Indian names/emails; fixed by switching to English (India), adding pronunciation guidance, and forcing email confirmation before booking.

**Tradeoff.** Chose lower-latency voice responses over exhaustive spoken citations: chat keeps richer citations, while voice uses short grounded answers and tool calls so barge-in and booking remain usable under the 2s first-response target.

**Two more weeks.** Add repository-level code search, automated voice regression tests, richer calendar negotiation, production observability, and a larger labelled eval set.
