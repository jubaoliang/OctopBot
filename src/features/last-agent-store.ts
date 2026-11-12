/**
 * Last-used expert id — kept out of route modules so root `_layout` can
 * register secure-storage accessors without importing a screen file (which
 * breaks Fast Refresh / can duplicate AppShell context).
 */

let lastAgentGetter: (() => Promise<string | null>) | null = null;
let lastAgentSetter: ((id: string) => Promise<void>) | null = null;

export function registerLastAgentStore(
  get: () => Promise<string | null>,
  set: (id: string) => Promise<void>,
): void {
  lastAgentGetter = get;
  lastAgentSetter = set;
}

export function readLastAgentId(): Promise<string | null> {
  return lastAgentGetter ? lastAgentGetter() : Promise.resolve(null);
}

export function writeLastAgentId(id: string): Promise<void> {
  return lastAgentSetter ? lastAgentSetter(id) : Promise.resolve();
}
