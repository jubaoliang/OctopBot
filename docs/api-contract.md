# Octop API Contract — Mobile Client

Pinned server version: **Octop 1.0.3b4** (upstream `TencentCloud/Octop`, `develop` branch). Source citations are repo-relative paths in the server checkout. The live OpenAPI schema (`GET /api/openapi.json`, requires `enable_api_docs: true`) is regenerable ground truth; this document is the mobile-client scope of it.

## Conventions

- Base URL: user-configured at runtime (self-hosted instance). All paths below are relative to it.
- All bodies are JSON unless noted (multipart for uploads).
- **Error envelope** (every error, server `src/octop/infra/errors.py`):
  ```json
  { "error": { "code": "AUTH_FAILED", "message": "...", "details": {} } }
  ```
- Auth: `Authorization: Bearer <JWT>` (or `?access_token=` for HTTP; `?token=` for WebSockets). JWT claims: `sub`, `uname`, `role`, `purpose`, `mfa_version`, `password_version`; default TTL 24h.
- **Sliding renewal**: when remaining token life < 2/3 TTL, any authenticated response carries a fresh token in response header `X-Octop-Access-Token`. No refresh endpoint — the client replaces its stored token. Password change or MFA enrollment invalidates old tokens.

## Auth (`src/octop/api/routers/auth.py`)

| Method | Path                        | Notes                                                                                                                                                                                                                                                               |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`           | `{username, password, captcha_token?}` → `{access_token, token_type:"Bearer", expires_in, user:{id, username, role, display_name, locale, permissions}}`. With MFA enrolled → `{mfa_required:true, mfa_token, methods, user_hint, locale}` (challenge token 300 s). |
| POST   | `/api/auth/mfa/verify`      | `{mfa_token, ...factor}` → same access-token payload.                                                                                                                                                                                                               |
| GET    | `/api/auth/me`              | `{id, username, role, display_name, locale, permissions, has_password, avatar_icon, avatar_url, ...}`                                                                                                                                                               |
| PATCH  | `/api/auth/me`              | `{display_name?, locale?, avatar_icon?}`                                                                                                                                                                                                                            |
| POST   | `/api/auth/logout`          | 204 (audit only; stateless JWT).                                                                                                                                                                                                                                    |
| GET    | `/api/auth/captcha`         | `{provider, site_key?}` — check before login; include `captcha_token` if configured.                                                                                                                                                                                |
| POST   | `/api/auth/change-password` | `{old_password, new_password}` → 204 + `X-Octop-Access-Token`.                                                                                                                                                                                                      |

Setup flow (`/api/setup/*`) exists for first-run bootstrap; the mobile app targets already-initialized instances and surfaces `SETUP_REQUIRED` (409 / 503 `{"setup_required":true}`) as "open the web console first".

## Agents (`src/octop/api/routers/agents.py`)

| Method           | Path                                         | Notes                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET              | `/api/agents?scope=mine\|all`                | Items: `{id, agent_id, name, description, persona_mbti, default_model, state, icon_name, icon_url, color, welcome_message, is_shared, owner_username, kind:"expert"\|"team", member_ids, unread_count, ...}`. `mine` = own + shared. |
| POST             | `/api/agents`                                | Create (201).                                                                                                                                                                                                                        |
| GET/PATCH/DELETE | `/api/agents/{id}`                           | Owner-or-admin; 404 `AGENT_NOT_FOUND`, 403 `FORBIDDEN`.                                                                                                                                                                              |
| POST             | `/api/agents/{id}/start` / `stop` / `reload` | 204.                                                                                                                                                                                                                                 |
| GET              | `/api/agents/{id}/status`                    | `{state, last_error, channels[], cron_jobs[], memory_maintenance}`.                                                                                                                                                                  |
| POST             | `/api/agents/{id}/read`                      | 204, clears unread.                                                                                                                                                                                                                  |
| GET/PUT          | `/api/agents/{id}/tool-settings`             | Tool toggles.                                                                                                                                                                                                                        |

## Teams (`src/octop/api/routers/teams.py`) — new in 1.0.x

`GET/POST /api/teams`, `GET/PATCH/DELETE /api/teams/{team_id}`. A team chats through the same `/api/agents/{team_id}/chat/ws`; member messages carry `agent_id`, wrap-up carries `team_wrapup`.

## Experts & hub (`src/octop/api/routers/experts.py`)

- `GET /api/experts` (bundled), `GET /api/experts/{expert_id}`.
- `GET /api/experts/hub?q&scene` → `{items, scenes}` (octop.cloud market); `POST /api/experts/hub/{slug}/install` (201).
- `POST /api/agents/from-expert/{expert_id}` — empty `name` + `agent_id` = idempotent "ensure ready".
- Published (private) experts: `GET /api/experts/published…`, `POST /api/agents/{agent_id}/publish-expert`.

## Threads & history (`src/octop/api/routers/chat/history.py`)

| Method | Path                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/agents/{agent_id}/threads?limit=50`                 | Item: `{thread_id, title, last_active, created_at, pinned, unread_count, turn_active, conversation_mode, model_ref, ...}`.                                                                                                                                                                                                                                                            |
| POST   | `/api/agents/{agent_id}/threads`                          | 201 `{thread_id, session_key}`.                                                                                                                                                                                                                                                                                                                                                       |
| GET    | `…/threads/{thread_id}/history?limit=25&offset=0&cursor=` | limit clamp 1..200. → `{thread_id, messages[], has_more, next_cursor, turn_active, hitl_pending}`. Message: `{id?, role:"user"\|"assistant"\|"tool", content:[blocks], created_at?, status?:"error", error_code?}`; blocks: `{type:"text",text}` \| `{type:"thinking",thinking}` \| `{type:"tool_use",name,id,input}` \| `{type:"tool_result",id,name,output,artifact?,error_code?}`. |
| PATCH  | `…/threads/{thread_id}`                                   | `{title?, pinned?, model_ref?, reasoning_mode?, conversation_mode?, hitl_policy?}`.                                                                                                                                                                                                                                                                                                   |
| DELETE | `…/threads/{thread_id}`                                   | 204; **409 `THREAD_TURN_ACTIVE`** while streaming.                                                                                                                                                                                                                                                                                                                                    |
| POST   | `…/threads/{thread_id}/read` / `cancel`                   | read → 204; cancel → `{thread_id, cancelled:true}` (HTTP stop).                                                                                                                                                                                                                                                                                                                       |
| POST   | `…/threads/{thread_id}/fork`                              | 201, `{message_id?}`.                                                                                                                                                                                                                                                                                                                                                                 |
| GET    | `…/threads/{thread_id}/history/export`                    | JSON attachment `octop-history-v2`.                                                                                                                                                                                                                                                                                                                                                   |

## Chat WebSocket (`src/octop/api/routers/chat/ws.py`)

`WS /api/agents/{agent_id}/chat/ws?token=<JWT>`. Close codes: `4001` bad token, `4003` forbidden, `4404` agent not found, `1011` gateway not ready.

Client → server (a bare non-JSON string is treated as `user_turn`):

- `{"type":"user_turn", "text"|"messages", "thread_id?", "model"?, "reasoning_mode"?:"auto"|"enabled"|"disabled", "reasoning_effort"?, "conversation_mode"?:"ask"|"plan"|"craft", "knowledge_base_ids"?, "mcp_servers"?, "skills"?, "delivery"?:"auto"|"steer"|"follow_up", "client_pending_id"?, "expected_turn_id"?}` — attachments are content blocks `{type:"image"|"file", workspace_path, filename?, media_type?}` referencing prior uploads.
- `{"type":"ping"}` → `{"type":"pong"}` (application-level heartbeat; server sends none).
- `{"type":"subscribe","thread_id"}` — (re)attach this connection; replies with `turn_status` (`active` tells whether a turn is streaming), optional steer snapshot, team catch-up.
- `{"type":"cancel","thread_id"}` — disconnect does NOT cancel; this does.
- `{"type":"steer_remove","thread_id","turn_id","client_pending_id","pending_id"}`.

Server → client (broadcast frames carry `thread_id`):

- Lifecycle: `turn.started {turn_id, seq, phase}`, `turn.resumed`, `turn.ended {turn_id, failed, hitl_paused?}`.
- `user {content, message_id?, author, attachments?}` (echo).
- Streaming: `token {content}` (text delta), `reasoning {content}` (thinking delta), `tool_call_chunk {name, args, index, display_name}`, `tool_result {name, id, output, artifact?, display_name}`, `state_update {node}`.
- `hitl_required {request:{…, pending_id}}` — turn pauses; resume via SSE below.
- `done {duration_ms?, conversation_mode?, pending_plan_path?, hitl_paused?, team_member_continuing?}` — errors are always followed by `done`.
- `error {message, error_code?}`, `thread_title {title}`, `attachment {kind, mime_type, data(base64), filename?}`.
- Steering: `steer.ack/queued/drained/discarded/removed/queue_snapshot` (mid-turn steering, 1.0.2b8+).

**Busy-thread rules**: `delivery:"auto"` while busy → steer (requires `client_pending_id` + `expected_turn_id`, else `steer.rejected`); `follow_up` while busy → rejected; new steers rejected while an HITL card is pending.

## HITL resume — SSE (`src/octop/api/routers/chat/routes.py`, `sse.py`)

`POST /api/agents/{agent_id}/chat/hitl/resume` with `{thread_id, decisions[], pending_id?}`; decision = `{"type":"approve"}` | `{"type":"reject","message"?}` | `{"type":"edit","edited_action":{…}}` | `{"type":"respond","message"}`. Response is `text/event-stream`, single event name `chunk`, data = same JSON frames as WS, ending in `done` (or `done {hitl_paused:true}` when another card appears). Legacy `chat/stream` SSE endpoint is gone.

## Uploads & text assist

- `POST /api/agents/{agent_id}/upload` (multipart `file`) → `{workspace_path, url, filename, media_type}` — files land in the agent workspace `inbound/`; the WS turn references them by `workspace_path`.
- `POST /api/text/assist` `{kind, text?, context?, locale?}` → `{text}`.
- `GET /api/agents/{agent_id}/chat/welcome` → `{welcome_message:{zh,en}, quick_prompts, task_examples}`.

## Notifications WebSocket (`src/octop/api/routers/chat/notify_ws.py`)

`WS /api/notifications/ws?token=<JWT>` — user-scoped; inbound `ping` only; pushes `dashboard_push {agent_id, thread_id, text, agent_name}` (cron reminders, proactive care). Same close codes as chat WS.

## Knowledge bases (`src/octop/api/routers/knowledge_bases.py`)

- `GET /api/knowledge-bases` → visible KBs (`{knowledge_base_id, name, description, visibility fields, owner_username…}`).
- `GET /{kb_id}/documents?prefix=` (tree), `GET /{kb_id}/documents/{doc_id}/preview` (extracted text), `GET …/chunks`, `GET …/file?disposition=`, `GET/PUT …/content`.
- Mutations: `POST /{kb_id}/documents` (multipart), `POST …/text`, `POST …/rename`, `DELETE …/{doc_id}`, `POST …/reindex`.
- No HTTP semantic search — retrieval happens via the agent's `search_knowledge` tool during a turn.

## Cron & proactive care (`cron.py`, `proactive_care.py`)

- `GET/POST /api/agents/{agent_id}/cron` (POST 201: `{name?, trigger:"cron:0 9 * * *"|"interval:3600"|"date:…"|"agently:…", prompt, enabled, ...}`); `GET/PATCH/DELETE …/cron/{cron_id}` (toggle via PATCH `enabled`), `POST …/run-now` (204); `GET /api/cron/settings` → `{timezone}`; `GET …/cron/examples`.
- `GET/PUT /api/agents/{agent_id}/proactive-care` → `{enabled, active_hours_start, active_hours_end, min_interval_hours, max_interval_hours}`.

## Token usage (`src/octop/api/routers/usage.py`)

Derived from upstream `develop` on 2026-11-12, after the 1.0.3b4 pin; a server without the usage ledger answers 404, which the client reports as "not supported".

- `GET /api/usage/summary?window=&granularity=&agent_id=` → the caller's own roll-up. `agent_id` narrows to one visible expert (`AGENT_NOT_FOUND` otherwise). An invalid `window` is a 400.
- `window`: `today` | `yesterday` | `last_7d` | `last_30d` (default) | `all` | `day:YYYY-MM-DD` | `month:YYYY-MM` | `range:YYYY-MM-DD:YYYY-MM-DD`. `today`/`yesterday` start at midnight in the server's default timezone; `last_7d`/`last_30d` are rolling (now − N×24 h), so they touch N+1 calendar days.
- `granularity`: `total` (no buckets) | `by_day` (default) | `by_agent` | `by_model` | `by_user`.
- Response: `{window, granularity, range_start, range_end, input_tokens, uncached_input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens, total_tokens, model_calls, turns, cache_hit_percent, avg_per_turn, buckets[]}`. `range_*` are unix seconds (`range_start` 0 for `all`); `cache_hit_percent` is a whole percent of input tokens; `turns` counts ledger rows.
- Bucket: `{key, label, …the same counters}`. `by_day`: key = `YYYY-MM-DD`, **newest first**, days without usage omitted, the day boundary is UTC on the default SQLite ledger (session timezone on PostgreSQL). `by_agent`: key = agent id, label = expert name. `by_model`: key = model name, `(unknown)` when the row has none. `by_agent`/`by_model`/`by_user` are sorted by `total_tokens` descending. Every granularity is capped at 100 buckets, so `all` + `by_day` is truncated to the newest 100 active days.
- Not used by mobile: `GET /api/usage/export.xlsx`, `?as_user=` (admin), `/api/admin/usage/*`.

## Preferences, settings, health

- `GET/PATCH /api/preferences` → `{locale, preferred_model?, model_reasoning?, timezone?, sidebar_nav?}`.
- `GET /api/settings/timezone`, `/api/settings/upload {max_upload_mb}`, `/api/settings/hitl {enabled,…}`, `/api/settings/capabilities {mobile:{enabled, backend}}`.
- `GET /api/health` (public) → `{ok:true, started_at, db, users_loaded, agents_running, channels[]}` — use for server-URL validation at login.

## Error codes (mobile-relevant)

`AUTH_FAILED`/`TOKEN_EXPIRED` 401 · `FORBIDDEN` 403 · `NOT_FOUND`/`AGENT_NOT_FOUND`/`KNOWLEDGE_NOT_FOUND` 404 · `SETUP_REQUIRED` 409 · `THREAD_TURN_ACTIVE` 409 (delete while streaming) · `LOGIN_LOCKED` 423 · `MFA_INVALID` · `KNOWLEDGE_DOC_TOO_LARGE` (details `max_mb`) · `KNOWLEDGE_NAME_TAKEN`.

## Voice (STT)

Hybrid speech input for the composer. Default active STT is the builtin
`browser` preset (system / on-device recognition on the client). Cloud
providers are optional.

- `GET /api/voice/active` → `{stt, tts, stt_realtime?}`. `stt` / `tts` default to `"browser"`.
- `PUT /api/voice/active` body `{stt?, tts?}` → same shape. Requires the `voice` permission.
- `GET /api/voice/providers` → configured provider rows (`id, name, kind, capability, enabled, …`).
- `POST /api/voice/stt` multipart form `{audio, language?, provider?}` → `{text, confidence?}`. Used when `active.stt` is a cloud provider; `browser` never hits this endpoint.

Realtime `WS /api/voice/stt-stream` and TTS playback are out of scope for mobile v1.

## Out of scope for mobile v1

Admin/user management, provider admin CRUD, IM channels, connectors, memory, workspace files, skills CRUD, bridge, update, cloud, terminal, plugins, `/api/mobile/*` (capability-gated, revisit later). Available if the design calls for them.
