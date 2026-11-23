/**
 * Device tools an expert may call, executed ON THE PHONE. Pure TypeScript:
 * specs + JSON input schemas + validation + a registry that binds handlers
 * supplied by `src/platform/device-tools.ts`. The chat layer registers these
 * on the agent WebSocket and answers `device_tool_call` frames; nothing here
 * touches React Native or the network.
 *
 * Reads run under the Connect capability consent; writes and outbound
 * actions carry `requiresConfirmation` so the thread shows an INLINE
 * approval card in the conversation (never a popup) before executing.
 */

export type DeviceToolName =
  | 'calendar.list_events'
  | 'calendar.create_event'
  | 'calendar.update_event'
  | 'calendar.delete_event'
  | 'contacts.search'
  | 'phone.dial'
  | 'phone.call'
  | 'sms.compose'
  | 'sms.read'
  | 'sms.send'
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

export interface UpdateEventInput {
  /** Event id from calendar.list_events. */
  id: string;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
}

export interface DeleteEventInput {
  id: string;
}

export interface ReadSmsInput {
  /** Case-insensitive substring of the sender number or message body. */
  query?: string;
  /** Newest-first cap, 1..100. Defaults to 20. */
  limit?: number;
}

export interface SendSmsInput {
  number: string;
  body: string;
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

export interface DeviceSmsMessage {
  id: string;
  /** Sender (inbox) or recipient (sent) number. */
  address: string;
  body: string;
  /** Epoch milliseconds. */
  date: number;
  type: 'inbox' | 'sent';
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
  /** Optional capabilities — a missing handler drops the tool from the registry. */
  updateEvent?: (input: UpdateEventInput) => Promise<{ id: string }>;
  deleteEvent?: (input: DeleteEventInput) => Promise<{ id: string }>;
  readSms?: (input: ReadSmsInput) => Promise<DeviceSmsMessage[]>;
  sendSms?: (input: SendSmsInput) => Promise<{ status: 'sent' }>;
  call?: (input: DialInput) => Promise<{ status: 'placed' }>;
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
      "Create an event on the user's device calendar. The thread shows an inline approval card before it runs.",
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
    name: 'calendar.update_event',
    description:
      "Update an existing event on the user's device calendar by the id returned from calendar.list_events. Only the provided fields change. The thread shows an inline approval card before it runs.",
    inputSchema: schema(
      {
        id: STRING,
        title: STRING,
        start: STRING,
        end: STRING,
        allDay: BOOLEAN,
        location: STRING,
        notes: STRING,
      },
      ['id'],
    ),
    requiresConfirmation: true,
  },
  {
    name: 'calendar.delete_event',
    description:
      "Delete an event from the user's device calendar by the id returned from calendar.list_events. The thread shows an inline approval card before it runs.",
    inputSchema: schema({ id: STRING }, ['id']),
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
      'Open the OS dialer pre-filled with a number; the user places the call. Never dials silently. Inline approval card first.',
    inputSchema: schema({ number: STRING }, ['number']),
    requiresConfirmation: true,
  },
  {
    name: 'phone.call',
    description:
      "Place a phone call directly from the user's device (Android only). The thread shows an inline approval card with the number before the call is placed.",
    inputSchema: schema({ number: STRING }, ['number']),
    requiresConfirmation: true,
  },
  {
    name: 'sms.compose',
    description:
      'Open the OS messaging composer pre-filled with a number and optional body; the user sends it. Inline approval card first.',
    inputSchema: schema({ number: STRING, body: STRING }, ['number']),
    requiresConfirmation: true,
  },
  {
    name: 'sms.read',
    description:
      "Read recent SMS messages on the user's device (Android only), newest first, across inbox and sent. Optional query filters by sender number or body substring. Returns address, body, epoch-ms date and inbox/sent type. Read-only.",
    inputSchema: schema({
      query: STRING,
      limit: { ...NUMBER, minimum: 1, maximum: 100 },
    }),
    requiresConfirmation: false,
  },
  {
    name: 'sms.send',
    description:
      "Send an SMS directly from the user's device (Android only). The thread shows an inline approval card with the number and full body before it is sent.",
    inputSchema: schema({ number: STRING, body: STRING }, ['number', 'body']),
    requiresConfirmation: true,
  },
  {
    name: 'mail.compose',
    description:
      'Open the OS mail composer pre-filled with recipient, subject and body; the user sends it. Inline approval card first.',
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
    case 'calendar.update_event': {
      if (!str(rec.id)) {
        return 'id is required';
      }
      if (rec.start !== undefined) {
        const start = str(rec.start);
        if (!start || Number.isNaN(Date.parse(start))) {
          return 'start must be a parseable ISO date';
        }
      }
      if (rec.end !== undefined) {
        const end = str(rec.end);
        if (!end || Number.isNaN(Date.parse(end))) {
          return 'end must be a parseable ISO date';
        }
      }
      return null;
    }
    case 'calendar.delete_event':
      if (!str(rec.id)) {
        return 'id is required';
      }
      return null;
    case 'contacts.search':
      if (rec.limit !== undefined && num(rec.limit, 1, 50) === null) {
        return 'limit must be a number in 1..50';
      }
      return null;
    case 'sms.read':
      if (rec.limit !== undefined && num(rec.limit, 1, 100) === null) {
        return 'limit must be a number in 1..100';
      }
      return null;
    case 'sms.send':
      if (!str(rec.number)) {
        return 'number is required';
      }
      if (!str(rec.body)) {
        return 'body is required';
      }
      return null;
    case 'phone.call':
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
      case 'calendar.update_event': {
        const handler = handlers.updateEvent;
        if (!handler) {
          throw new Error('calendar.update_event unsupported on this platform');
        }
        return handler({
          id: str(rec.id) ?? '',
          title: str(rec.title) ?? undefined,
          start: str(rec.start) ?? undefined,
          end: str(rec.end) ?? undefined,
          allDay: rec.allDay === undefined ? undefined : rec.allDay === true,
          location: str(rec.location) ?? undefined,
          notes: str(rec.notes) ?? undefined,
        });
      }
      case 'calendar.delete_event': {
        const handler = handlers.deleteEvent;
        if (!handler) {
          throw new Error('calendar.delete_event unsupported on this platform');
        }
        return handler({ id: str(rec.id) ?? '' });
      }
      case 'contacts.search':
        return handlers.searchContacts({
          query: str(rec.query) ?? undefined,
          limit: num(rec.limit, 1, 50) ?? undefined,
        });
      case 'phone.dial':
        return handlers.dial({ number: str(rec.number) ?? '' });
      case 'phone.call': {
        const handler = handlers.call;
        if (!handler) {
          throw new Error('phone.call unsupported on this platform');
        }
        return handler({ number: str(rec.number) ?? '' });
      }
      case 'sms.compose':
        return handlers.composeSms({
          number: str(rec.number) ?? '',
          body: str(rec.body) ?? undefined,
        });
      case 'sms.read': {
        const handler = handlers.readSms;
        if (!handler) {
          throw new Error('sms.read unsupported on this platform');
        }
        return handler({
          query: str(rec.query) ?? undefined,
          limit: num(rec.limit, 1, 100) ?? undefined,
        });
      }
      case 'sms.send': {
        const handler = handlers.sendSms;
        if (!handler) {
          throw new Error('sms.send unsupported on this platform');
        }
        return handler({ number: str(rec.number) ?? '', body: str(rec.body) ?? '' });
      }
      case 'mail.compose':
        return handlers.composeMail({
          to: str(rec.to) ?? '',
          subject: str(rec.subject) ?? undefined,
          body: str(rec.body) ?? undefined,
        });
    }
  };
  const hasHandler = (name: DeviceToolName): boolean => {
    switch (name) {
      case 'calendar.update_event':
        return handlers.updateEvent !== undefined;
      case 'calendar.delete_event':
        return handlers.deleteEvent !== undefined;
      case 'sms.read':
        return handlers.readSms !== undefined;
      case 'sms.send':
        return handlers.sendSms !== undefined;
      case 'phone.call':
        return handlers.call !== undefined;
      default:
        return true;
    }
  };
  return DEVICE_TOOL_SPECS.filter(spec => hasHandler(spec.name)).map(spec => ({
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
