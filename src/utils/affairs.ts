/** A distilled affair extracted from an expert's conversation digest. */
export interface Affair {
  title: string;
  due?: string;
  status?: string;
}

/**
 * Parse structured affairs out of an expert's distillation output. The
 * distill routine is prompted to emit a JSON array of {title, due?, status?};
 * models sometimes wrap it in prose or a code fence, so locate the first
 * JSON array in the text and tolerate missing/extra fields. Returns [] when
 * nothing parseable is present (never throws).
 */
export function parseAffairs(text: string): Affair[] {
  if (!text) {
    return [];
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: Affair[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item.trim()) {
        out.push({ title: item.trim() });
      }
      continue;
    }
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const title = rec.title ?? rec.name ?? rec.task ?? rec.item;
    if (typeof title !== 'string' || !title.trim()) {
      continue;
    }
    const affair: Affair = { title: title.trim() };
    const due = rec.due ?? rec.date ?? rec.deadline;
    if (typeof due === 'string' && due.trim()) {
      affair.due = due.trim();
    }
    const status = rec.status ?? rec.state;
    if (typeof status === 'string' && status.trim()) {
      affair.status = status.trim();
    }
    out.push(affair);
  }
  return out;
}
