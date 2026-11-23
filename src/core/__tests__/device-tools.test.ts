import {
  createDeviceToolRegistry,
  DEVICE_TOOL_SPECS,
  deviceToolRegisterPayload,
  dispatchDeviceTool,
  validateDeviceToolInput,
  type DeviceToolHandlers,
} from '../device-tools';

function handlers(overrides: Partial<DeviceToolHandlers> = {}): DeviceToolHandlers {
  return {
    listEvents: async () => [],
    createEvent: async () => ({ id: 'e1' }),
    searchContacts: async () => [],
    dial: async () => ({ status: 'opened' }),
    composeSms: async () => ({ status: 'opened' }),
    composeMail: async () => ({ status: 'opened' }),
    ...overrides,
  };
}

describe('device tool specs', () => {
  it('covers the full tool set with inline confirmation on writes/actions', () => {
    expect(DEVICE_TOOL_SPECS.map(spec => spec.name)).toEqual([
      'calendar.list_events',
      'calendar.create_event',
      'calendar.update_event',
      'calendar.delete_event',
      'contacts.search',
      'phone.dial',
      'phone.call',
      'sms.compose',
      'sms.read',
      'sms.send',
      'mail.compose',
    ]);
    const reads = new Set(['calendar.list_events', 'contacts.search', 'sms.read']);
    for (const spec of DEVICE_TOOL_SPECS) {
      expect(spec.requiresConfirmation).toBe(!reads.has(spec.name));
    }
  });

  it('serializes a snake_case register payload', () => {
    const payload = deviceToolRegisterPayload(createDeviceToolRegistry(handlers()));
    expect(payload[0]).toMatchObject({
      name: 'calendar.list_events',
      requires_confirmation: false,
    });
    expect(payload[0].input_schema).toMatchObject({ type: 'object' });
  });

  it('drops optional tools whose platform handler is missing', () => {
    const tools = createDeviceToolRegistry(handlers());
    expect(tools.map(tool => tool.name)).toEqual([
      'calendar.list_events',
      'calendar.create_event',
      'contacts.search',
      'phone.dial',
      'sms.compose',
      'mail.compose',
    ]);
    const full = createDeviceToolRegistry(
      handlers({
        updateEvent: async () => ({ id: 'e1' }),
        deleteEvent: async () => ({ id: 'e1' }),
        readSms: async () => [],
        sendSms: async () => ({ status: 'sent' }),
        call: async () => ({ status: 'placed' }),
      }),
    );
    expect(full.map(tool => tool.name)).toEqual(DEVICE_TOOL_SPECS.map(spec => spec.name));
  });
});

describe('validateDeviceToolInput', () => {
  it('rejects non-object input', () => {
    expect(validateDeviceToolInput('phone.dial', 'x')).not.toBeNull();
  });

  it('requires title and a parseable start for create_event', () => {
    expect(
      validateDeviceToolInput('calendar.create_event', { start: '2026-11-23T09:00' }),
    ).not.toBeNull();
    expect(
      validateDeviceToolInput('calendar.create_event', { title: 'X', start: 'not-a-date' }),
    ).not.toBeNull();
    expect(
      validateDeviceToolInput('calendar.create_event', { title: 'X', start: '2026-11-23T09:00' }),
    ).toBeNull();
  });

  it('bounds days and limit', () => {
    expect(validateDeviceToolInput('calendar.list_events', { days: 0 })).not.toBeNull();
    expect(validateDeviceToolInput('calendar.list_events', { days: 7 })).toBeNull();
    expect(validateDeviceToolInput('contacts.search', { limit: 99 })).not.toBeNull();
  });

  it('requires number / to for actions', () => {
    expect(validateDeviceToolInput('phone.dial', {})).not.toBeNull();
    expect(validateDeviceToolInput('sms.compose', { number: '123' })).toBeNull();
    expect(validateDeviceToolInput('mail.compose', { to: 'a@b.c' })).toBeNull();
  });

  it('requires an id and parseable dates for update_event', () => {
    expect(validateDeviceToolInput('calendar.update_event', {})).not.toBeNull();
    expect(validateDeviceToolInput('calendar.update_event', { id: 'e1' })).toBeNull();
    expect(
      validateDeviceToolInput('calendar.update_event', { id: 'e1', start: 'not-a-date' }),
    ).not.toBeNull();
    expect(
      validateDeviceToolInput('calendar.update_event', { id: 'e1', end: '2026-11-23T10:00' }),
    ).toBeNull();
  });

  it('requires an id for delete_event', () => {
    expect(validateDeviceToolInput('calendar.delete_event', {})).not.toBeNull();
    expect(validateDeviceToolInput('calendar.delete_event', { id: 'e1' })).toBeNull();
  });

  it('bounds sms.read limit and requires number + body for sms.send', () => {
    expect(validateDeviceToolInput('sms.read', {})).toBeNull();
    expect(validateDeviceToolInput('sms.read', { limit: 101 })).not.toBeNull();
    expect(validateDeviceToolInput('sms.read', { limit: 50, query: 'bank' })).toBeNull();
    expect(validateDeviceToolInput('sms.send', { number: '123' })).not.toBeNull();
    expect(validateDeviceToolInput('sms.send', { body: 'hi' })).not.toBeNull();
    expect(validateDeviceToolInput('sms.send', { number: '123', body: 'hi' })).toBeNull();
    expect(validateDeviceToolInput('phone.call', {})).not.toBeNull();
    expect(validateDeviceToolInput('phone.call', { number: '123' })).toBeNull();
  });
});

describe('dispatchDeviceTool', () => {
  it('routes to the matching handler with normalized input', async () => {
    const seen: unknown[] = [];
    const tools = createDeviceToolRegistry(
      handlers({
        listEvents: async input => {
          seen.push(input);
          return [];
        },
      }),
    );
    const result = await dispatchDeviceTool(tools, 'calendar.list_events', { days: 3 });
    expect(result).toEqual({ ok: true, output: [] });
    expect(seen).toEqual([{ days: 3 }]);
  });

  it('returns an error result for unknown tools', async () => {
    const tools = createDeviceToolRegistry(handlers());
    const result = await dispatchDeviceTool(tools, 'nope', {});
    expect(result.ok).toBe(false);
  });

  it('returns an error result for invalid input without calling the handler', async () => {
    let called = false;
    const tools = createDeviceToolRegistry(
      handlers({
        createEvent: async () => {
          called = true;
          return { id: 'e1' };
        },
      }),
    );
    const result = await dispatchDeviceTool(tools, 'calendar.create_event', {});
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  it('converts handler throws into error results', async () => {
    const tools = createDeviceToolRegistry(
      handlers({
        dial: async () => {
          throw new Error('no dialer');
        },
      }),
    );
    const result = await dispatchDeviceTool(tools, 'phone.dial', { number: '123' });
    expect(result).toEqual({ ok: false, error: 'no dialer' });
  });

  it('routes the direct telephony and calendar write tools', async () => {
    const seen: Record<string, unknown> = {};
    const tools = createDeviceToolRegistry(
      handlers({
        updateEvent: async input => {
          seen.update = input;
          return { id: input.id };
        },
        deleteEvent: async input => {
          seen.delete = input;
          return { id: input.id };
        },
        readSms: async input => {
          seen.read = input;
          return [];
        },
        sendSms: async input => {
          seen.send = input;
          return { status: 'sent' };
        },
        call: async input => {
          seen.call = input;
          return { status: 'placed' };
        },
      }),
    );
    expect(
      await dispatchDeviceTool(tools, 'calendar.update_event', {
        id: 'e1',
        title: 'Moved',
        start: '2026-11-24T09:00',
        allDay: false,
      }),
    ).toEqual({ ok: true, output: { id: 'e1' } });
    expect(seen.update).toEqual({
      id: 'e1',
      title: 'Moved',
      start: '2026-11-24T09:00',
      end: undefined,
      allDay: false,
      location: undefined,
      notes: undefined,
    });
    expect(await dispatchDeviceTool(tools, 'calendar.delete_event', { id: 'e1' })).toEqual({
      ok: true,
      output: { id: 'e1' },
    });
    expect(await dispatchDeviceTool(tools, 'sms.read', { limit: 5 })).toEqual({
      ok: true,
      output: [],
    });
    expect(seen.read).toEqual({ query: undefined, limit: 5 });
    expect(await dispatchDeviceTool(tools, 'sms.send', { number: '123', body: 'hi' })).toEqual({
      ok: true,
      output: { status: 'sent' },
    });
    expect(await dispatchDeviceTool(tools, 'phone.call', { number: '123' })).toEqual({
      ok: true,
      output: { status: 'placed' },
    });
  });
});
