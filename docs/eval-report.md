# AI Persona Eval Report

**Voice quality.** Tested N calls through Vapi using Twilio PSTN. First-response latency was measured from call connection to first synthesized token in Vapi logs; p50: TODO ms, p95: TODO ms. Transcription accuracy was manually labelled on TODO utterances with names, repo titles, and interruptions; word accuracy: TODO%. Booking task completion: TODO/TODO calls successfully checked calendar, proposed a free slot, created an event, and sent confirmation.

**Chat groundedness.** Built a golden set of TODO questions across resume, GitHub READMEs, recent commits, adversarial prompt injections, and unknown facts. Hallucination rate was measured by manual labels plus a judge pass that required every factual claim to be supported by retrieved chunks; hallucination rate: TODO%. Retrieval quality was measured by checking whether expected source files appeared in top-5 chunks; precision@5: TODO, recall@5: TODO.

**Failure modes and fixes.** (1) TODO failure: root cause TODO; fix TODO. (2) TODO failure: root cause TODO; fix TODO. (3) TODO failure: root cause TODO; fix TODO.

**Tradeoff.** Chose TODO over TODO because TODO.

**Two more weeks.** Add repository-level code search, automated voice regression tests, richer calendar negotiation, production observability, and a larger labelled eval set.
