/**
 * Device tools an expert may call, executed ON THE PHONE. Pure TypeScript:
 * specs + JSON input schemas + validation + a registry that binds handlers
 * supplied by `src/platform/device-tools.ts`. The chat layer registers these
 * on the agent WebSocket and answers `device_tool_call` frames; nothing here
 * touches React Native or the network.
 *
 * Reads run under the Connect capability consent; writes/actions carry
 * `requiresConfirmation` so the chat layer asks the user in conversation
 * before executing.
 */

export type DeviceToolName =
  | 'calendar.list_events'
  | 'calendar.create_event'
  | 'contacts.search'
  | 'phone.dial'
  | 'sms.compose'
  | 'mail.compose';

export interface ListEventsInput {
  /** Window length in days from now (1..30). Defaults to 7. */
  days?: number;
}

export interface CreateEventInput {
  title: string;
  /** ISO 8601 local or zoned start. */
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
}

export interface SearchContactsInput {
  query?: string;
  limit?: number;
}

export interface DialInput {
  number: string;
}

export interface ComposeSmsInput {
  number: string;
  body?: string;
}

export interface ComposeMailInput {
  to: string;
  subject?: string;
  body?: string;
}

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location: string | null;
}

export interface DeviceContact {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
}

/** OS hand-off result; dial/compose never execute silently. */
export interface DeviceActionResult {
  status: 'opened' | 'cancelled' | 'unsupported';
}

export interface DeviceToolHandlers {
  listEvents: (input: ListEventsInput) => Promise<DeviceCalendarEvent[]>;
  createEvent: (input: CreateEventInput) => Promise<{ id: string }>;
  searchContacts: (input: SearchContactsInput) => Promise<DeviceContact[]>;
  dial: (input: DialInput) => Promise<DeviceActionResult>;
  composeSms: (input: ComposeSmsInput) => Promise<DeviceActionResult>;
  composeMail: (input: ComposeMailInput) => Promise<DeviceActionResult>;
}

export interface DeviceToolSpec {
  name: DeviceToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresConfirmation: boolean;
}

const STRING = { type: 'string' } as const;
const NUMBER = { type: 'number' } as const;
const BOOLEAN = { type: 'boolean' } as const;

function schema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false };
}

export const DEVICE_TOOL_SPECS: DeviceToolSpec[] = [
  {
    name: 'calendar.list_events',
    description:
      "Read the user's device calendar events within a window of days from now. Returns title, start/end epoch ms, all-day flag and location. Read-only.",
    inputSchema: schema({ days: { ...NUMBER, minimum: 1, maximum: 30 } }),
    requiresConfirmation: false,
  },
  {
    name: 'calendar.create_event',
    description:
      "Create an event on the user's device calendar. Requires the user's in-chat confirmation before it runs.",
    inputSchema: schema(
      {
        title: STRING,
        start: STRING,
        end: STRING,
        allDay: BOOLEAN,
        location: STRING,
        notes: STRING,
      },
      ['title', 'start'],
    ),
    requiresConfirmation: true,
  },
  {
    name: 'contacts.search',
    description:
      "Search the user's device address book by name substring; returns name, phone numbers and emails. Read-only.",
    inputSchema: schema({
      query: STRING,
      limit: { ...NUMBER, minimum: 1, maximum: 50 },
    }),
    requiresConfirmation: false,
  },
  {
    name: 'phone.dial',
    description:
      'Open the OS dialer pre-filled with a number; the user places the call. Never dials silently. Requires in-chat confirmation.',
    inputSchema: schema({ number: STRING }, ['number']),
    requiresConfirmation: true,
  },
  {
    name: 'sms.compose',
    description:
      'Open the OS messaging composer pre-filled with a number and optional body; the user sends it. Requires in-chat confirmation.',
    inputSchema: schema({ number: STRING, body: STRING }, ['number']),
    requiresConfirmation: true,
  },
  {
    name: 'mail.compose',
    description:
      'Open the OS mail composer pre-filled with recipient, subject and body; the user sends it. Requires in-chat confirmation.',
    inputSchema: schema({ to: STRING, subject: STRING, body: STRING }, ['to']),
    requiresConfirmation: true,
  },
];

export interface DeviceTool extends DeviceToolSpec {
  execute: (input: unknown) => Promise<unknown>;
}

function asRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function num(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/** Returns an error message for malformed agent input, or null when valid. */
export function validateDeviceToolInput(name: DeviceToolName, input: unknown): string | null {
  const rec = asRecord(input);
  if (!rec) {
    return 'input must be an object';
  }
  switch (name) {
    case 'calendar.list_events':
      if (rec.days !== undefined && num(rec.days, 1, 30) === null) {
        return 'days must be a number in 1..30';
      }
      return null;
    case 'calendar.create_event': {
      if (!str(rec.title)) {
        return 'title is required';
      }
      const start = str(rec.start);
      if (!start || Number.isNaN(Date.parse(start))) {
        return 'start must be a parseable ISO date';
      }
      if (rec.end !== undefined) {
        const end = str(rec.end);
        if (!end || Number.isNaN(Date.parse(end))) {
          return 'end must be a parseable ISO date';
        }
      }
      return null;
    }
    case 'contacts.search':
      if (rec.limit !== undefined && num(rec.limit, 1, 50) === null) {
        return 'limit must be a number in 1..50';
      }
      return null;
    case 'phone.dial':
    case 'sms.compose':
      if (!str(rec.number)) {
        return 'number is required';
      }
      return null;
    case 'mail.compose':
      if (!str(rec.to)) {
        return 'to is required';
      }
      return null;
  }
}

/** Binds platform handlers to the specs, validating input before execution. */
export function createDeviceToolRegistry(handlers: DeviceToolHandlers): DeviceTool[] {
  const run = (name: DeviceToolName, input: unknown): Promise<unknown> => {
    const rec = asRecord(input) ?? {};
    switch (name) {
      case 'calendar.list_events':
        return handlers.listEvents({ days: num(rec.days, 1, 30) ?? undefined });
      case 'calendar.create_event':
        return handlers.createEvent({
          title: str(rec.title) ?? '',
          start: str(rec.start) ?? '',
          end: str(rec.end) ?? undefined,
          allDay: rec.allDay === true,
          location: str(rec.location) ?? undefined,
          notes: str(rec.notes) ?? undefined,
        });
      case 'contacts.search':
        return handlers.searchContacts({
          query: str(rec.query) ?? undefined,
          limit: num(rec.limit, 1, 50) ?? undefined,
        });
      case 'phone.dial':
        return handlers.dial({ number: str(rec.number) ?? '' });
      case 'sms.compose':
        return handlers.composeSms({
          number: str(rec.number) ?? '',
          body: str(rec.body) ?? undefined,
        });
      case 'mail.compose':
        return handlers.composeMail({
          to: str(rec.to) ?? '',
          subject: str(rec.subject) ?? undefined,
          body: str(rec.body) ?? undefined,
        });
    }
  };
  return DEVICE_TOOL_SPECS.map(spec => ({
    ...spec,
    execute: async (input: unknown) => {
      const error = validateDeviceToolInput(spec.name, input);
      if (error) {
        throw new Error(error);
      }
      return run(spec.name, input);
    },
  }));
}

export type DeviceToolDispatch = { ok: true; output: unknown } | { ok: false; error: string };

/** Routes a `device_tool_call` to its tool; failures become error results. */
export async function dispatchDeviceTool(
  tools: DeviceTool[],
  name: string,
  input: unknown,
): Promise<DeviceToolDispatch> {
  const tool = tools.find(candidate => candidate.name === name);
  if (!tool) {
    return { ok: false, error: `unknown device tool: ${name}` };
  }
  try {
    return { ok: true, output: await tool.execute(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Wire payload for the `device_tools.register` client frame. */
export function deviceToolRegisterPayload(tools: DeviceTool[]): {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  requires_confirmation: boolean;
}[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
    requires_confirmation: tool.requiresConfirmation,
  }));
}
