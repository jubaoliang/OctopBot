# Personal assistant roadmap

OctopBot is a personal assistant, not a chat window: it should notice what
needs doing, act on a schedule, and come back with results. The delivery
loop already exists — server cron runs a turn as the user, the reply lands
in the expert's thread, and the notifications WebSocket pushes it to the
device (tab dot, unread badges). This roadmap lists what builds on that
loop, in priority order, and what each item depends on.

Shipped already: per-expert welcome prompts, the Today card (next calendar
event + unread + routines shortcut), the routine builder with morning /
evening briefing presets, and per-expert suggested routines.

## 1. Briefing artifact card

**Goal:** a briefing arrives as a concise chat paragraph plus a tappable
document card ("Morning briefing · Nov 20") that opens the full write-up.

- Server: the briefing turn saves its long form as a knowledge document (or
  a dedicated artifact) and emits a `tool_result` with an `artifact`
  reference. Needs an artifact/document tool in the agent runtime.
- Client: render `ContentBlock` `tool_result.artifact` as a card row in the
  thread (title, date, source icon) and open it through the existing
  knowledge preview screen. The contract types already carry `artifact?:
unknown` on tool results; the shape needs pinning first.

## 2. Structured reminders & deadlines

**Goal:** briefings can say "two repayments land on the 27th" because the
assistant tracks dated obligations, not just calendar events.

- A reminders capability (date + label + optional recurrence) the user can
  create conversationally ("remind me that the card bill is due on the
  27th") and the briefing prompt can query.
- Options: a server-side reminders store exposed to the agent, or a
  dedicated knowledge document the agent maintains. Either way the client
  surface is the same: the briefing text, plus a reminders list under
  Automation.
- Depends on: upstream storage + tool; no client-only shortcut is honest
  here (parsing dates out of chat history is not a source of truth).

## 3. Approvals inbox (needs-you)

**Goal:** one place to answer everything waiting on the user — HITL
confirmations, failed routines, permission requests — instead of hunting
through threads.

- Server: a cross-thread pending list. `hitl_pending` exists per thread
  history today; the thread list does not carry it, so an inbox needs a new
  endpoint (or the field added to the list payload).
- Client: an inbox surface (drawer entry or Today card section) listing
  pending items with approve/reject inline, reusing the thread screen's
  HITL resume path. The notifications needs-you loop already signals that
  something is waiting.

## 4. Proactive care settings

**Goal:** the assistant checks in on its own within boundaries the user
sets — active hours, minimum/maximum interval, on/off.

- Server: `proactive_care.py` exists; `ProactiveCareConfig` is already
  mirrored in `src/core/api/types.ts`, but no settings endpoint is in the
  pinned contract. Re-derive from upstream and add it here.
- Client: a settings group (toggle + active-hours range + interval) under
  Settings or Automation, next to the notifications master switch.

## 5. Per-expert memory

**Goal:** each expert remembers its own context (preferences, recurring
tasks, past decisions) separate from global account settings.

- Server: a per-agent memory store with read/write tools and a maintenance
  job (`memory_maintenance` already appears in the agent status payload).
- Client: a memory viewer/editor per expert (Me → expert, or the expert
  detail), so memory is inspectable and deletable — trust requires seeing
  what is remembered.

## 6. Slash-invoked skills

**Goal:** typing `/` in the composer offers the expert's quick prompts and
saved routines as invocable skills, the way the home pills work today.

- Client-only for the first slice: the welcome `quick_prompts` and the
  cron roster are already fetched; a `/` prefix opens a filtered chooser
  and selecting an item drafts its prompt (same draft handoff as pills).
- Later: user-defined skills (named prompt templates) stored per expert.

## 7. Generative result cards

**Goal:** structured results render as interactive cards (tables, charts,
checklists) instead of prose — the markdown table and bar chart primitives
already exist.

- Server: a component/artifact protocol on tool results (kind + props).
- Client: a small registry of card renderers fed by that protocol, drawn
  with the existing `react-native-svg` chart split (geometry in
  `src/utils/`, drawing in components). No chart library.

## 8. Secrets vault

**Goal:** credentials the assistant uses for connected services live in an
encrypted vault, never in conversation transcripts.

- Server: a vault store with per-connector grants; the agent references
  secrets by name at call time.
- Client: a vault management screen (list grants, revoke), following the
  secure-storage wrapper rules. The app already keeps the user's own
  session in secure storage; this extends the discipline to the assistant's
  service credentials.

## Sequencing

1–2 make the briefings genuinely useful (they need upstream tools first).
3–4 are mostly client work once two small endpoints land. 5–8 are larger
product surfaces; each should start with a contract re-derivation from
upstream before any client code.

## E2E preconditions for the proactive surfaces

The shipped flows (`home-prompts`, `automation-starters`, `routine-builder`)
run against a server with at least one expert that has welcome prompts and
no cron jobs. Two deeper checks need environment setup the flows cannot do
themselves:

- **A real briefing turn** (run-now → assistant reply → push → unread) needs
  the test expert to have a working `default_model`. A fresh server with no
  providers configured fails expert turns with `no_models_configured`; the
  implicit `main` agent uses a server-level default that is not exposed via
  the API. Configure a provider/model on the server first.
- **The Today card's event row** needs a readable device calendar with an
  event today and the calendar permission granted; the unread row needs a
  reply that lands while its thread is not focused (seed via a proactive
  turn once models work). The card's selection/formatting logic is covered
  by unit tests (`today-card`, `count-unread`) in the meantime.
