# ClinicSoft Agent — Frontend

Next.js 16 · React 19 · Tailwind 4 · shadcn/ui (Base UI) · Recharts · TanStack Table

The UI's job is to make the agent's reasoning visible. A user who can watch the SQL
appear and be checked before the answer arrives can tell you when it is wrong — which is
the whole point of putting an agent in front of a database rather than behind one.

## Screens

| Route | What it is for |
|---|---|
| `/ask` | The conversation. Each answer shows the six-stage trace, the SQL it ran (highlighted, copyable, with rationale and any validator repairs), an auto-chart when the shape suits one, a sortable table with CSV export, then the narrated answer streaming in. Refusals render as a distinct card explaining *why*. |
| `/insights` | The 24 operational patterns planted in the demo data, each as a one-click question. Clicking switches to the right persona and asks it. |
| `/explore` | Every table and report view, by ClinicSoft module, with row counts, vendor labels and tier badges. Columns the current persona cannot see are absent — exactly as they are absent from the model's context. |
| `/guardrails` | The four enforcement layers, a live check of the security invariants against the database, and nine "try to break it" questions that demonstrate each refusal. |

## The persona switcher

Top-right. Eight demo principals, each a different read-only database role:

```
Group Owner · Branch Manager (AUH01) · Billing Lead · Claims Coordinator
Medical Coder · Treating Clinician · Front Desk (DXB01) · Compliance Auditor
```

Switching persona starts a new conversation — a persona is a security context and
nothing carries across. The same question asked as two personas is the most convincing
minute of the demo: a branch manager asking about another branch gets **zero rows**, by
row-level security, with no help from the UI.

## Run it

```bash
pnpm install
cp .env.local.example .env.local      # NEXT_PUBLIC_API_BASE=http://127.0.0.1:8099
pnpm dev                              # http://localhost:3000
```

The backend must be running (`../backend/run.sh`). Its CORS allow-list includes
`localhost:3000` and `localhost:5173`.

## How streaming works

`POST /v1/ask` returns Server-Sent Events. The client uses `fetch` + `ReadableStream`
rather than `EventSource`, because the question travels in a POST body. The parser is
tolerant of re-chunking by a proxy. Event → UI mapping lives in `src/lib/store.ts`:

```
status   → trace stepper advances
sql      → SQL block appears (collapsed; badges for tables, tier, patient-scope)
repair   → the block records the rejected attempt and the reason
rows     → chart (if chartable) + table
token    → answer streams, with a caret
rejected → refusal card
done     → footer: latency, rows, cost, model, tier
```

## Layout

```
src/lib/          api (SSE client) · store (zustand) · types · personas · insights · format
src/components/
  shell/          app-shell · persona-switcher · theme-provider
  chat/           chat-thread · message · agent-trace · sql-block · result-table ·
                  result-chart · answer · composer · suggestions · empty-state · tier-badge
src/app/          ask · insights · explore · guardrails
```

## Charts

`chartPlan()` in `result-chart.tsx` decides whether a result is chartable: one
categorical or temporal column, one to four numeric ones, 2–60 rows. Anything else is a
table, and a table is never wrong. Temporal x-axes default to a line; everything else a
bar. Money columns are detected by name and formatted as AED.

## Auth

Dev header auth (`X-Tenant`, `X-Subject`). Production swaps this for
`Authorization: Bearer <jwt>` in `src/lib/api.ts`; the backend refuses header auth when
`ENV=prod`.

## Diary actions and dictation

- Asking who is free renders a slot picker; tapping a time drops a booking sentence into
  the composer. Sending it produces a proposal card with Confirm / Cancel and a countdown.
  Nothing is written until Confirm; the card then shows the appointment reference.
- The microphone button uses the browser's own speech recognition (Chrome, Edge,
  Safari). It renders only where the engine exists. Audio goes to the browser vendor's
  recogniser, not to this backend — keep that in mind before dictating patient details.
