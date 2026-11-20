import { buildContactsDigest, type ContactDigestCard } from '../digest';

function card(name: string, phones: string[], emails: string[]): ContactDigestCard {
  return { name, phones, emails };
}

describe('buildContactsDigest', () => {
  it('renders name sections with tel and email lines, sorted', () => {
    const digest = buildContactsDigest([
      card('Zoe', ['+86139'], ['zoe@example.com']),
      card('Alice Chen', ['+86138'], []),
    ]);
    const aliceIndex = digest.indexOf('### Alice Chen');
    const zoeIndex = digest.indexOf('### Zoe');
    expect(aliceIndex).toBeGreaterThan(-1);
    expect(zoeIndex).toBeGreaterThan(aliceIndex);
    expect(digest).toContain('# My contacts (2 people, from the device address book)');
    expect(digest).toContain('- tel: +86138');
    expect(digest).toContain('- email: zoe@example.com');
    expect(digest).toMatch(/_Generated \d{4}-\d{2}-\d{2} \d{2}:\d{2} from the device contacts\._$/);
  });

  it('omits missing fields and renders the empty roster', () => {
    const digest = buildContactsDigest([card('No Channels', [], [])]);
    expect(digest).toContain('### No Channels');
    expect(digest).not.toContain('tel:');
    expect(buildContactsDigest([])).toContain('# My contacts (0 people');
  });
});
