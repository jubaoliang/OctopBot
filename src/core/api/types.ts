/**
 * Domain types mirroring docs/api-contract.md (Octop 1.0.3b4).
 * Field names follow the server exactly; optional = may be absent in payloads.
 */

// ---------------------------------------------------------------------------
// Auth & user
// ---------------------------------------------------------------------------

export interface OctopUser {
  id: string;
  username: string;
  role: string;
  display_name: string | null;
  locale: string | null;
  permissions: string[];
  has_password?: boolean;
  avatar_icon?: string | null;
  avatar_url?: string | null;
}

export interface LoginResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: OctopUser;
}

export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
  methods: string[];
  user_hint: string | null;
  locale: string | null;
}

// ---------------------------------------------------------------------------
// Agents, teams, experts

/** Quick prompt payload from the welcome endpoint: plain strings per locale,
 * or a {zh,en} pair depending on server shape. */
export type QuickPrompts = string[] | { zh?: string[]; en?: string[] } | null;

// ---------------------------------------------------------------------------
// Agents, teams, experts
// ---------------------------------------------------------------------------

export type AgentKind = 'expert' | 'team';

export interface AgentSummary {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  kind: AgentKind;
  state: string;
  default_model: string | null;
  icon_name: string | null;
  icon_url: string | null;
  color: string | null;
  welcome_message: string | null;
  is_shared: boolean;
  owner_username: string | null;
  member_ids?: string[];
  unread_count: number;
  persona_mbti?: string | null;
}

export interface AgentStatus {
  state: string;
  last_error: string | null;
  channels: { id: string; kind: string; name: string }[];
  cron_jobs: { id: string; prompt: string; trigger: string }[];
}

// ---------------------------------------------------------------------------
// Threads & history
// ---------------------------------------------------------------------------

export interface ThreadSummary {
  thread_id: string;
  title: string | null;
  last_active: string | null;
  created_at: string | null;
  pinned: boolean;
  unread_count: number;
  turn_active: boolean;
  conversation_mode: ConversationMode | null;
  model_ref: string | null;
}

export type ConversationMode = 'ask' | 'plan' | 'craft';
export type ReasoningMode = 'auto' | 'enabled' | 'disabled';
export type ChatRole = 'user' | 'assistant' | 'tool';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; name: string; id: string; input: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      output: unknown;
      artifact?: unknown;
      error_code?: string;
    };

export interface HistoryMessage {
  id?: string;
  role: ChatRole;
  content: ContentBlock[];
  created_at?: string;
  status?: 'error';
  error_code?: string;
  agent_id?: string;
  duration_ms?: number;
}

export interface HistoryPage {
  thread_id: string;
  messages: HistoryMessage[];
  has_more: boolean;
  next_cursor: string | null;
  turn_active: boolean;
  hitl_pending: boolean;
}

// ---------------------------------------------------------------------------
// Chat WebSocket frames (docs/api-contract.md → Chat WebSocket)
// ---------------------------------------------------------------------------

export interface TurnAttachment {
  type: 'image' | 'file';
  workspace_path: string;
  filename?: string;
  media_type?: string;
}

export interface UserTurnFrame {
  type: 'user_turn';
  text: string;
  thread_id?: string;
  model?: string;
  reasoning_mode?: ReasoningMode;
  reasoning_effort?: string;
  conversation_mode?: ConversationMode;
  knowledge_base_ids?: string[];
  delivery?: 'auto' | 'steer' | 'follow_up';
  client_pending_id?: string;
  expected_turn_id?: string;
  attachments?: TurnAttachment[];
}

export type ClientFrame =
  | UserTurnFrame
  | { type: 'ping' }
  | { type: 'subscribe'; thread_id: string }
  | { type: 'cancel'; thread_id: string };

export type ServerFrame =
  | { type: 'turn.started'; turn_id: string; seq: number; phase: string; thread_id?: string }
  | { type: 'turn.resumed'; thread_id?: string }
  | {
      type: 'turn.ended';
      turn_id: string;
      failed: boolean | null;
      hitl_paused?: boolean;
      thread_id?: string;
    }
  | {
      type: 'user';
      content: string;
      message_id?: string;
      thread_id?: string;
      attachments?: TurnAttachment[];
    }
  | { type: 'token'; content: string; thread_id?: string }
  | { type: 'reasoning'; content: string; thread_id?: string }
  | {
      type: 'tool_call_chunk';
      name: string;
      args: unknown;
      index: number;
      display_name?: string;
      thread_id?: string;
    }
  | {
      type: 'tool_result';
      name: string;
      id: string;
      output: unknown;
      artifact?: unknown;
      display_name?: string;
      thread_id?: string;
    }
  | { type: 'state_update'; node: string; thread_id?: string }
  | {
      type: 'hitl_required';
      request: { pending_id: string; [key: string]: unknown };
      thread_id?: string;
    }
  | {
      type: 'done';
      duration_ms?: number;
      hitl_paused?: boolean;
      team_member_continuing?: boolean;
      thread_id?: string;
    }
  | { type: 'error'; message: string; error_code?: string; thread_id?: string }
  | { type: 'thread_title'; thread_id: string; title: string }
  | { type: 'attachment'; kind: string; mime_type: string; data: string; filename?: string }
  | { type: 'pong' }
  | { type: 'turn_status'; thread_id: string; active: boolean }
  | {
      type: 'steer.ack';
      status: string;
      reason?: string;
      turn_id?: string;
      pending_id?: string;
      queue_length?: number;
    }
  | { type: string; [key: string]: unknown }; // forward-compat: unknown frames are ignored, never crash

// ---------------------------------------------------------------------------
// Knowledge bases, cron, proactive care
// ---------------------------------------------------------------------------

export interface KnowledgeBase {
  knowledge_base_id: string;
  name: string;
  description: string | null;
  shared: boolean;
  owner_username: string | null;
  icon_url: string | null;
}

export interface KnowledgeDocument {
  /** Primary id; some payloads only send `document_id`. */
  id?: string;
  path: string;
  /** Basename; folders and files both carry this. */
  filename: string;
  /** True for folder rows; omit/false = file. */
  is_dir?: boolean;
  byte_size?: number;
  updated_at?: number | string | null;
  /** Alias of `id` on some payloads. */
  document_id?: string;
}

export type CronTrigger = string; // "cron:0 9 * * *" | "interval:3600" | "date:…" | "agently:…"

export interface CronJob {
  id: string;
  name: string | null;
  trigger: CronTrigger;
  prompt: string;
  enabled: boolean;
  next_run?: string | null;
}

export interface ProactiveCareConfig {
  enabled: boolean;
  active_hours_start: string;
  active_hours_end: string;
  min_interval_hours: number;
  max_interval_hours: number;
}

export interface DashboardPush {
  type: 'dashboard_push';
  agent_id: string;
  thread_id: string | null;
  text: string;
  agent_name: string | null;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

// ── Token usage (src/octop/api/routers/usage.py) ────────────────────────────

/** Time scope of a usage query. Dates are `YYYY-MM-DD`, months `YYYY-MM`. */
export type UsageWindow =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_30d'
  | 'all'
  | `day:${string}`
  | `month:${string}`
  | `range:${string}:${string}`;

export type UsageGranularity = 'total' | 'by_day' | 'by_agent' | 'by_model' | 'by_user';

export interface UsageCounters {
  input_tokens: number;
  uncached_input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  model_calls: number;
  turns: number;
}

/**
 * One slice of a summary. `key` is the day (`YYYY-MM-DD`), agent id, model
 * name (`(unknown)` when the ledger has none) or user id; `label` is the
 * display name where the server knows one (expert names, user names).
 */
export interface UsageBucket extends UsageCounters {
  key: string;
  label: string;
}

export interface UsageSummary extends UsageCounters {
  window: string;
  granularity: string;
  /** Unix seconds; `range_start` is 0 for the `all` window. */
  range_start: number;
  range_end: number;
  /** Whole percent of input tokens served from cache. */
  cache_hit_percent: number;
  avg_per_turn: number;
  /** `by_day` is newest first; the others are largest first. At most 100. */
  buckets: UsageBucket[];
}

export interface HealthStatus {
  ok: boolean;
  started_at?: string;
  db?: string;
  users_loaded?: number;
  agents_running?: number;
}

export interface Preferences {
  locale: string | null;
  preferred_model?: string | null;
  timezone?: string | null;
}

export interface UploadResult {
  workspace_path: string;
  url: string;
  filename: string;
  media_type: string;
}

// ---------------------------------------------------------------------------
// Voice (STT / TTS active config)
// ---------------------------------------------------------------------------

export type VoiceCapability = 'stt' | 'tts' | 'both';

export interface ActiveVoice {
  stt: string;
  tts: string;
  /** True when the active STT provider can stream over WebSocket. */
  stt_realtime?: boolean;
}

export interface VoiceProvider {
  id: number;
  name: string;
  kind: string;
  capability: VoiceCapability;
  enabled: boolean;
  note?: string | null;
}

export interface VoiceTranscribeResult {
  text: string;
  confidence?: number | null;
}
