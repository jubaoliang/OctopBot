import type {
  LocalizedList,
  LocalizedText,
  QuickPrompts,
  QuickPromptItem,
  TaskExamples,
} from '@/core/api/types';

/** One rendered suggestion: the pill label and the message body a tap drafts. */
export interface QuickPromptChoice {
  label: string;
  text: string;
  iconName?: string;
}

/** Resolve server copy that may be a plain string or a zh/en pair. */
export function resolveLocalized(
  value: LocalizedText | null | undefined,
  locale: string,
): string | null {
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }
  if (!value) {
    return null;
  }
  const preferred = locale.startsWith('zh') ? value.zh : value.en;
  const picked = preferred ?? value.zh ?? value.en;
  return picked && picked.length > 0 ? picked : null;
}

/** Locale-picked string list with cross-locale fallback, junk filtered. */
function localizedList(payload: LocalizedList | null | undefined, locale: string): string[] {
  if (!payload) {
    return [];
  }
  const list =
    (locale.startsWith('zh') ? payload.zh : payload.en) ?? payload.zh ?? payload.en ?? [];
  return list.filter((s): s is string => typeof s === 'string' && s.length > 0);
}

function isRichItem(value: unknown): value is QuickPromptItem {
  return typeof value === 'object' && value !== null && 'title' in value;
}

/**
 * Normalize the welcome endpoint's quick_prompts to renderable choices.
 * Current servers send rich items (localized title + prompt body + icon);
 * legacy plain-string and {zh,en} string-list shapes still resolve. The
 * prompt body — not the title — is what a tap drafts, so templates like
 * "Summarize the following:\n\n" arrive ready for the user to complete.
 */
export function resolveQuickPrompts(payload: QuickPrompts, locale: string): QuickPromptChoice[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    const choices: QuickPromptChoice[] = [];
    for (const entry of payload) {
      if (typeof entry === 'string') {
        if (entry.length > 0) {
          choices.push({ label: entry, text: entry });
        }
        continue;
      }
      if (!isRichItem(entry)) {
        continue;
      }
      const label = resolveLocalized(entry.title, locale);
      if (!label) {
        continue;
      }
      const text = resolveLocalized(entry.prompt, locale) ?? label;
      const iconName = typeof entry.icon_name === 'string' ? entry.icon_name : undefined;
      choices.push(iconName ? { label, text, iconName } : { label, text });
    }
    return choices;
  }
  const list = localizedList(payload, locale);
  return list.map(s => ({ label: s, text: s }));
}

/** Locale-aware routine examples from the welcome endpoint. */
export function resolveTaskExamples(payload: TaskExamples, locale: string): string[] {
  return localizedList(payload, locale);
}
