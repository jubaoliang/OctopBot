import {
  exceedsUploadLimit,
  sendableAttachments,
  toTurnAttachment,
  type PendingAttachment,
} from '../attachments';

describe('toTurnAttachment', () => {
  it('maps an image upload to an image block', () => {
    expect(
      toTurnAttachment({
        workspace_path: 'inbound/a.png',
        url: '/f/a.png',
        filename: 'a.png',
        media_type: 'image/png',
      }),
    ).toEqual({
      type: 'image',
      workspace_path: 'inbound/a.png',
      filename: 'a.png',
      media_type: 'image/png',
    });
  });

  it('maps non-images to file blocks', () => {
    expect(
      toTurnAttachment({
        workspace_path: 'inbound/a.pdf',
        url: '/f/a.pdf',
        filename: 'a.pdf',
        media_type: 'application/pdf',
      }).type,
    ).toBe('file');
  });
});

describe('exceedsUploadLimit', () => {
  it('compares bytes to the MB cap', () => {
    expect(exceedsUploadLimit(10 * 1024 * 1024, 10)).toBe(false);
    expect(exceedsUploadLimit(10 * 1024 * 1024 + 1, 10)).toBe(true);
  });

  it('lets unknown sizes through', () => {
    expect(exceedsUploadLimit(undefined, 10)).toBe(false);
  });
});

describe('sendableAttachments', () => {
  const ready: PendingAttachment = {
    id: '1',
    uri: 'file:///1.jpg',
    filename: '1.jpg',
    status: 'ready',
    attachment: { type: 'image', workspace_path: 'inbound/1.jpg' },
  };

  it('returns an empty list when nothing is pending', () => {
    expect(sendableAttachments([])).toEqual([]);
  });

  it('returns the ready attachments', () => {
    expect(sendableAttachments([ready])).toEqual([ready.attachment]);
  });

  it('blocks while uploading or after a failure', () => {
    expect(sendableAttachments([ready, { ...ready, id: '2', status: 'uploading' }])).toBeNull();
    expect(sendableAttachments([{ ...ready, id: '3', status: 'failed' }])).toBeNull();
  });
});
