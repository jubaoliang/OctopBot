import {
  BookOpen,
  CalendarClock,
  Cloud,
  FileText,
  Mail,
  MessageSquare,
  Terminal,
  Wallet,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

/**
 * The icon set Octop's expert templates and quick prompts use (lucide names
 * from the server's manifest). A null-prototype object: server-supplied
 * names like "constructor" must never resolve to Object.prototype members.
 * Unknown names yield undefined — call sites fall back to no glyph / the
 * agent's initial. Look up inline at the use site: the compiler's
 * static-components rule cannot see through a helper call.
 */
export const EXPERT_ICONS: Partial<Record<string, LucideIcon>> = Object.assign(
  Object.create(null) as Partial<Record<string, LucideIcon>>,
  {
    zap: Zap,
    terminal: Terminal,
    cloud: Cloud,
    'file-text': FileText,
    'message-square': MessageSquare,
    'calendar-clock': CalendarClock,
    mail: Mail,
    wallet: Wallet,
    'book-open': BookOpen,
  },
);
