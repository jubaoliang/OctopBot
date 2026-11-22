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
  it('covers the batch-1 tool set with confirmation only on writes/actions', () => {
    expect(DEVICE_TOOL_SPECS.map(spec => spec.name)).toEqual([
      'calendar.list_events',
      'calendar.create_event',
      'contacts.search',
      'phone.dial',
      'sms.compose',
      'mail.compose',
    ]);
    for (const spec of DEVICE_TOOL_SPECS) {
      const isRead = spec.name === 'calendar.list_events' || spec.name === 'contacts.search';
      expect(spec.requiresConfirmation).toBe(!isRead);
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
});
