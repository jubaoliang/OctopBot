import { formatDeviceToolCall, type DeviceToolCardCopy } from '../device-tool-summary';

const copy: DeviceToolCardCopy = {
  call: 'Call {number}',
  dial: 'Open dialer for {number}',
  smsSend: 'Send SMS to {number}',
  smsCompose: 'Compose SMS to {number}',
  mail: 'Email {to}',
  createEvent: 'Create event: {title}',
  updateEvent: 'Update event {id}',
  deleteEvent: 'Delete event {id}',
  readCalendar: 'Read calendar',
  searchContacts: 'Search contacts',
  readSms: 'Read SMS',
  body: 'Message: {body}',
  subject: 'Subject: {subject}',
  time: 'Time: {range}',
  location: 'Location: {location}',
  notes: 'Notes: {notes}',
  changes: 'Changes: {changes}',
  query: 'Filter: {query}',
  days: 'Next {days} days',
  limit: 'Newest {limit} messages',
  allDay: 'all day',
};

describe('formatDeviceToolCall', () => {
  it('renders an SMS send as a sentence plus the full body', () => {
    const text = formatDeviceToolCall(
      'sms.send',
      { number: '10086', body: 'octop device test' },
      copy,
    );
    expect(text.summary).toBe('Send SMS to 10086');
    expect(text.detail).toBe('Message: octop device test');
    expect(text.summary).not.toContain('{');
    expect(text.detail ?? '').not.toContain('{');
  });

  it('renders a call with the number only', () => {
    expect(formatDeviceToolCall('phone.call', { number: '10086' }, copy)).toEqual({
      summary: 'Call 10086',
    });
  });

  it('renders event creation with a local time range, location and notes', () => {
    // Offset-less ISO parses as device-local, so the wall clock is the same
    // on any runner timezone — the card must show the user's local time.
    const text = formatDeviceToolCall(
      'calendar.create_event',
      {
        title: 'Device Tool Test',
        start: '2026-11-24T15:00:00',
        end: '2026-11-24T16:00:00',
        location: 'Office',
        notes: 'bring laptop',
      },
      copy,
    );
    expect(text.summary).toBe('Create event: Device Tool Test');
    expect(text.detail).toContain('Time: 2026-11-24 15:00–16:00');
    expect(text.detail).toContain('Location: Office');
    expect(text.detail).toContain('Notes: bring laptop');
  });

  it('marks all-day events without a clock', () => {
    const text = formatDeviceToolCall(
      'calendar.create_event',
      { title: 'Holiday', start: '2026-12-01T00:00:00', allDay: true },
      copy,
    );
    expect(text.detail).toBe('Time: 2026-12-01 (all day)');
  });

  it('lists only the changed fields for an update', () => {
    const text = formatDeviceToolCall(
      'calendar.update_event',
      { id: '349', title: 'Moved', start: '2026-11-24T17:00:00' },
      copy,
    );
    expect(text.summary).toBe('Update event 349');
    expect(text.detail).toBe('Changes: Moved · 2026-11-24 17:00');
  });

  it('renders delete, reads and mail without JSON', () => {
    expect(formatDeviceToolCall('calendar.delete_event', { id: '349' }, copy).summary).toBe(
      'Delete event 349',
    );
    expect(formatDeviceToolCall('calendar.list_events', {}, copy).detail).toBe('Next 7 days');
    expect(formatDeviceToolCall('sms.read', { query: '10086', limit: 5 }, copy).detail).toBe(
      'Filter: 10086\nNewest 5 messages',
    );
    const mail = formatDeviceToolCall(
      'mail.compose',
      { to: 'a@b.c', subject: 'Hi', body: 'There' },
      copy,
    );
    expect(mail.summary).toBe('Email a@b.c');
    expect(mail.detail).toBe('Subject: Hi\nMessage: There');
  });

  it('tolerates malformed input without throwing', () => {
    expect(formatDeviceToolCall('sms.send', null, copy).summary).toBe('Send SMS to ');
    expect(
      formatDeviceToolCall('calendar.create_event', { title: 'X', start: 'nope' }, copy),
    ).toEqual({ summary: 'Create event: X' });
  });
});
