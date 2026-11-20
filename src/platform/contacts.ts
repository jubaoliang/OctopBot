import * as ExpoContacts from 'expo-contacts';
import { Platform } from 'react-native';

/**
 * Platform contacts reader — the ONLY place expo-contacts is imported
 * (AGENTS.md wrapper hygiene; a HarmonyOS shim swaps this module).
 *
 * Context-capability: when the user connects Contacts (Connect apps
 * screen), the compact digest (name/phones/emails) syncs into the agent's
 * knowledge base — no per-message attachment flow. The connect switch is
 * the consent gate.
 *
 * Best-effort everywhere (haptics.ts run() pattern).
 */

export type ContactsPermissionState = 'granted' | 'denied' | 'undetermined';

export interface ContactCard {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
}

export interface ContactsReader {
  getPermissionStatus: () => Promise<ContactsPermissionState>;
  requestPermissions: () => Promise<ContactsPermissionState>;
  /** All contacts, lightweight (name/phones/emails only). */
  listContacts: () => Promise<ContactCard[]>;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function toState(response: { granted?: boolean; status?: string }): ContactsPermissionState {
  if (response.granted) {
    return 'granted';
  }
  if (response.status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

function nameOf(contact: {
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}): string {
  return (
    contact.fullName?.trim() ||
    [contact.givenName, contact.familyName].filter(Boolean).join(' ').trim() ||
    'Unnamed'
  );
}

const noopReader: ContactsReader = {
  getPermissionStatus: async () => 'denied',
  requestPermissions: async () => 'denied',
  listContacts: async () => [],
};

const expoReader: ContactsReader = {
  getPermissionStatus: async () => {
    try {
      return toState(await ExpoContacts.getPermissionsAsync());
    } catch {
      return 'denied';
    }
  },
  requestPermissions: async () => {
    try {
      return toState(await ExpoContacts.requestPermissionsAsync());
    } catch {
      return 'denied';
    }
  },
  listContacts: async () => {
    try {
      // The SDK's Contact class carries methods we never use — read the
      // plain data shape only. Paged until exhausted so a large address
      // book is not silently truncated (hard cap keeps the digest bounded).
      const cards: ContactCard[] = [];
      const pageSize = 200;
      for (let offset = 0; offset < 1000; offset += pageSize) {
        let contacts: {
          id: string;
          fullName?: string | null;
          givenName?: string | null;
          familyName?: string | null;
          phones?: { number?: string | null }[];
          emails?: { email?: string | null }[];
        }[];
        try {
          contacts = await ExpoContacts.Contact.getAll({
            limit: pageSize,
            offset,
          });
        } catch {
          // A mid-pagination failure must not discard pages already read —
          // partial results still sync.
          break;
        }
        for (const contact of contacts) {
          cards.push({
            id: contact.id,
            name: nameOf(contact),
            phones: (contact.phones ?? [])
              .map(phone => phone.number?.trim() ?? '')
              .filter(number => number.length > 0),
            emails: (contact.emails ?? [])
              .map(email => email.email?.trim() ?? '')
              .filter(email => email.length > 0),
          });
        }
        if (contacts.length < pageSize) {
          break;
        }
      }
      return cards;
    } catch {
      return [];
    }
  },
};

export const contactsReader: ContactsReader = supported ? expoReader : noopReader;
