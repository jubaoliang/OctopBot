/**
 * Contacts digest — the opt-in document the device syncs into the agent's
 * knowledge base so turns can look up people without any explicit share.
 * Compact on purpose: name, phones, emails. Nothing else leaves the device.
 */

import { safeLine } from '../markdown-safe';

/** Minimal card shape the provider feeds in (keeps core platform-free). */
export interface ContactDigestCard {
  name: string;
  phones: string[];
  emails: string[];
}

export function buildContactsDigest(cards: ContactDigestCard[]): string {
  const sections = cards
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(card => {
      const lines = [`### ${safeLine(card.name)}`];
      for (const phone of card.phones) {
        lines.push(`- tel: ${safeLine(phone)}`);
      }
      for (const email of card.emails) {
        lines.push(`- email: ${safeLine(email)}`);
      }
      return lines.join('\n');
    });
  const stamp = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const generated = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;
  return [
    `# My contacts (${cards.length} people, from the device address book)`,
    ...sections,
    '',
    `_Generated ${generated} from the device contacts._`,
  ].join('\n');
}
