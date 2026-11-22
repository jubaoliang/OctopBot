import {
  createDeviceToolRegistry,
  type DeviceActionResult,
  type DeviceTool,
  type DeviceToolHandlers,
} from '@/core/device-tools';

import { calendarReader } from './calendar';
import { contactsReader } from './contacts';
import { requestAppAction, type LinkConfirmCopy } from './linking';

/**
 * Concrete device-tool handlers — the ONLY place the device-tool registry
 * meets platform capabilities (AGENTS.md wrapper hygiene). Reads check the
 * OS permission at call time so a revoked grant fails the tool instead of
 * silently returning empty; writes/actions hand off to the OS composer or
 * dialer through the confirmed linking wrapper (never silent).
 */
export function buildDeviceTools(copy: LinkConfirmCopy): DeviceTool[] {
  const requireCalendar = async () => {
    const state = await calendarReader.getPermissionStatus();
    if (state !== 'granted') {
      throw new Error('calendar permission not granted on the device');
    }
  };
  const requireContacts = async () => {
    const state = await contactsReader.getPermissionStatus();
    if (state !== 'granted') {
      throw new Error('contacts permission not granted on the device');
    }
  };
  const action = (url: string): Promise<DeviceActionResult> =>
    requestAppAction(url, copy).then(status => ({ status }));

  const handlers: DeviceToolHandlers = {
    listEvents: async ({ days }) => {
      await requireCalendar();
      const now = new Date();
      const end = new Date(now.getTime() + (days ?? 7) * 86_400_000);
      const calendars = await calendarReader.getReadableCalendars();
      return calendarReader.listEvents(
        calendars.map(calendar => calendar.id),
        now,
        end,
      );
    },
    createEvent: async input => {
      await requireCalendar();
      return calendarReader.createEvent(input);
    },
    searchContacts: async ({ query, limit }) => {
      await requireContacts();
      const cards = await contactsReader.listContacts();
      const needle = (query ?? '').trim().toLowerCase();
      const matched = needle
        ? cards.filter(card => card.name.toLowerCase().includes(needle))
        : cards;
      return matched.slice(0, limit ?? 20);
    },
    dial: ({ number }) => action(`tel:${encodeURIComponent(number)}`),
    composeSms: ({ number, body }) =>
      action(`sms:${encodeURIComponent(number)}${body ? `?body=${encodeURIComponent(body)}` : ''}`),
    composeMail: ({ to, subject, body }) => {
      const params = new URLSearchParams();
      if (subject) {
        params.set('subject', subject);
      }
      if (body) {
        params.set('body', body);
      }
      const qs = params.toString();
      return action(`mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ''}`);
    },
  };
  return createDeviceToolRegistry(handlers);
}
