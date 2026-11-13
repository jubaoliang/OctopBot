import {
  buildUserMessageContent,
  exceedsUploadLimit,
  mediaPreviewPath,
  sendableAttachments,
  serializeUserTurn,
  toTurnAttachment,
  turnAttachmentsFromInbound,
  type PendingAttachment,
} from '../attachments';

describe('toTurnAttachment', () => {
  it('maps an image upload to an image block and keeps the preview URL', () => {
    expect(
      toTurnAttachment(
        {
          workspace_path: 'inbound/a.png',
          url: '/api/agents/main/media/preview?source=inbound%2Fa.png',
          filename: 'a.png',
          media_type: 'image/png',
        },
        { localUri: 'file:///tmp/a.png' },
      ),
    ).toEqual({
      type: 'image',
      workspace_path: 'inbound/a.png',
      filename: 'a.png',
      media_type: 'image/png',
      url: '/api/agents/main/media/preview?source=inbound%2Fa.png',
      local_uri: 'file:///tmp/a.png',
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

describe('buildUserMessageContent / serializeUserTurn', () => {
  it('keeps plain text as a string when there are no attachments', () => {
    expect(buildUserMessageContent('hello')).toBe('hello');
    expect(serializeUserTurn({ text: 'hello' })).toEqual({ text: 'hello' });
  });

  it('embeds image attachments as messages content blocks', () => {
    const wire = serializeUserTurn({
      text: 'look',
      thread_id: 't1',
      attachments: [
        {
          type: 'image',
          workspace_path: 'inbound/a.png',
          filename: 'a.png',
          media_type: 'image/png',
          url: '/api/agents/a1/media/preview?source=inbound%2Fa.png',
          local_uri: 'file:///tmp/a.png',
        },
      ],
    });
    expect(wire).not.toHaveProperty('attachments');
    expect(wire.text).toBe('look');
    expect(wire.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look' },
          {
            type: 'image',
            source: {
              type: 'url',
              url: '/api/agents/a1/media/preview?source=inbound%2Fa.png',
              media_type: 'image/png',
            },
            preview_url: '/api/agents/a1/media/preview?source=inbound%2Fa.png',
            workspace_path: 'inbound/a.png',
            filename: 'a.png',
          },
        ],
      },
    ]);
    // local_uri must never leave the device.
    expect(JSON.stringify(wire)).not.toContain('file:///');
  });
});

describe('mediaPreviewPath / turnAttachmentsFromInbound', () => {
  it('builds the JWT preview path', () => {
    expect(mediaPreviewPath('a1', 'inbound/x.png', 'image/png')).toBe(
      '/api/agents/a1/media/preview?source=inbound%2Fx.png&mime_type=image%2Fpng',
    );
  });

  it('maps history inbound_attachments', () => {
    expect(
      turnAttachmentsFromInbound('a1', [
        {
          filename: 'x.png',
          media_type: 'image/png',
          kind: 'image',
          workspace_path: 'inbound/x.png',
        },
      ]),
    ).toEqual([
      {
        type: 'image',
        workspace_path: 'inbound/x.png',
        filename: 'x.png',
        media_type: 'image/png',
        url: '/api/agents/a1/media/preview?source=inbound%2Fx.png&mime_type=image%2Fpng',
      },
    ]);
  });
});
