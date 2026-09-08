import type { Routine } from './types';

/** Failed/invalid drafts survive a reload, isolated by account and routine. */
class RoutineDrafts extends Map<string, Routine> {
  private key(key: string): string {
    return `overload_routine_draft:${key}`;
  }
  override get(key: string): Routine | undefined {
    const cached = super.get(key);
    if (cached) return cached;
    try {
      const raw = localStorage.getItem(this.key(key));
      if (!raw) return undefined;
      const draft = JSON.parse(raw) as Routine;
      if (
        !draft ||
        typeof draft.id !== 'string' ||
        typeof draft.name !== 'string' ||
        !Array.isArray(draft.exercises)
      )
        return undefined;
      super.set(key, draft);
      return draft;
    } catch {
      return undefined;
    }
  }
  override has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  override set(key: string, draft: Routine): this {
    super.set(key, draft);
    try {
      localStorage.setItem(this.key(key), JSON.stringify(draft));
    } catch {
      /* Keep the in-memory copy and unsaved UI state. */
    }
    return this;
  }
  override delete(key: string): boolean {
    try {
      localStorage.removeItem(this.key(key));
    } catch {
      /* Storage may be unavailable. */
    }
    return super.delete(key);
  }
}
export const recoveryDrafts = new RoutineDrafts();
