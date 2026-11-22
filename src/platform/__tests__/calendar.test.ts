import * as ExpoCalendar from 'expo-calendar';

import { calendarReader } from '../calendar';

jest.mock('expo-calendar', () => ({
  getCalendarPermissions: jest.fn(),
  requestCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  listEvents: jest.fn(),
  EntityTypes: { EVENT: 'EVENT' },
}));

const expo = jest.mocked(ExpoCalendar);

describe('calendarReader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps permission responses', async () => {
    (expo.getCalendarPermissions as jest.Mock).mockResolvedValue({ granted: true });
    await expect(calendarReader.getPermissionStatus()).resolves.toBe('granted');
    (expo.requestCalendarPermissions as jest.Mock).mockResolvedValue({
      granted: false,
      status: 'denied',
    });
    await expect(calendarReader.requestPermissions()).resolves.toBe('denied');
    (expo.getCalendarPermissions as jest.Mock).mockResolvedValue({ granted: false });
    await expect(calendarReader.getPermissionStatus()).resolves.toBe('undetermined');
  });

  it('degrades permission failures to denied', async () => {
    (expo.getCalendarPermissions as jest.Mock).mockRejectedValue(new Error('no provider'));
    await expect(calendarReader.getPermissionStatus()).resolves.toBe('denied');
  });

  it('maps device calendars', async () => {
    (expo.getCalendars as jest.Mock).mockResolvedValue([
      { id: 'c1', title: 'Work', source: { name: 'work@example.com' }, allowsModifications: true },
      { id: 'c2', title: 'Family', source: null, allowsModifications: false },
    ]);
    await expect(calendarReader.getReadableCalendars()).resolves.toEqual([
      { id: 'c1', title: 'Work', source: 'work@example.com', allowsWrites: true },
      { id: 'c2', title: 'Family', source: null, allowsWrites: false },
    ]);
    expect(expo.getCalendars).toHaveBeenCalledWith(ExpoCalendar.EntityTypes.EVENT);
  });

  it('normalizes and sorts events, dropping broken dates', async () => {
    const listEvents = jest.fn().mockResolvedValue([
      {
        id: 'e2',
        title: 'Later',
        startDate: '2026-03-02T10:00:00.000Z',
        endDate: '2026-03-02T11:00:00.000Z',
        allDay: false,
        location: 'Office',
      },
      {
        id: 'e1',
        title: 'First',
        startDate: '2026-03-01T09:00:00.000Z',
        endDate: '2026-03-01T10:00:00.000Z',
        allDay: true,
        location: null,
      },
      {
        id: 'e3',
        title: 'Broken',
        startDate: 'not-a-date',
        endDate: '2026-03-03T09:00:00.000Z',
        allDay: false,
        location: null,
      },
    ]);
    (expo.getCalendars as jest.Mock).mockResolvedValue([{ id: 'c1', listEvents }]);
    const start = new Date('2026-03-01T00:00:00.000Z');
    const end = new Date('2026-03-08T00:00:00.000Z');
    const events = await calendarReader.listEvents(['c1'], start, end);
    expect(events.map(event => event.id)).toEqual(['e1', 'e2']);
    expect(events[1]).toMatchObject({
      id: 'e2',
      title: 'Later',
      start: Date.parse('2026-03-02T10:00:00.000Z'),
      allDay: false,
      location: 'Office',
    });
  });

  it('skips the query when no calendars are selected', async () => {
    await expect(calendarReader.listEvents([], new Date(), new Date())).resolves.toEqual([]);
    expect(expo.getCalendars).not.toHaveBeenCalled();
  });

  it('propagates calendar-list failures so callers can tell them from empty', async () => {
    (expo.getCalendars as jest.Mock).mockRejectedValue(new Error('no provider'));
    await expect(calendarReader.getReadableCalendars()).rejects.toThrow('no provider');
  });

  it('propagates event-query failures instead of masking them as empty', async () => {
    (expo.getCalendars as jest.Mock).mockResolvedValue([
      { id: 'c1', listEvents: jest.fn().mockRejectedValue(new Error('query failed')) },
    ]);
    await expect(calendarReader.listEvents(['c1'], new Date(), new Date())).rejects.toThrow(
      'query failed',
    );
  });

  it('creates an event on the first writable calendar', async () => {
    const createEvent = jest.fn().mockResolvedValue({ id: 'e9' });
    (expo.getCalendars as jest.Mock).mockResolvedValue([
      { id: 'ro', allowsModifications: false },
      { id: 'rw', allowsModifications: true, createEvent },
    ]);
    await expect(
      calendarReader.createEvent({ title: 'Standup', start: '2026-11-23T09:00:00' }),
    ).resolves.toEqual({ id: 'e9' });
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Standup',
        allDay: false,
        startDate: new Date('2026-11-23T09:00:00').toISOString(),
      }),
    );
  });

  it('passes ISO strings to the per-calendar read API (Android collapses Dates)', async () => {
    const listEvents = jest.fn().mockResolvedValue([]);
    (expo.getCalendars as jest.Mock).mockResolvedValue([{ id: 'c1', listEvents }]);
    const start = new Date('2026-11-23T00:00:00Z');
    const end = new Date('2026-11-30T00:00:00Z');
    await calendarReader.listEvents(['c1'], start, end);
    expect(listEvents).toHaveBeenCalledWith(start.toISOString(), end.toISOString());
  });

  it('rejects when the device has no writable calendar', async () => {
    (expo.getCalendars as jest.Mock).mockResolvedValue([{ id: 'ro', allowsModifications: false }]);
    await expect(
      calendarReader.createEvent({ title: 'Standup', start: '2026-11-23T09:00:00' }),
    ).rejects.toThrow('no writable calendar');
  });

  it('prefers a visible writable calendar so reads can see the event', async () => {
    const hidden = jest.fn().mockResolvedValue({ id: 'hidden' });
    const visible = jest.fn().mockResolvedValue({ id: 'visible' });
    (expo.getCalendars as jest.Mock).mockResolvedValue([
      { id: 'local', allowsModifications: true, isVisible: false, createEvent: hidden },
      { id: 'main', allowsModifications: true, isVisible: true, createEvent: visible },
    ]);
    await expect(
      calendarReader.createEvent({ title: 'Standup', start: '2026-11-23T09:00:00' }),
    ).resolves.toEqual({ id: 'visible' });
    expect(hidden).not.toHaveBeenCalled();
  });
});
