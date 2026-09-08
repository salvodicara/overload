import { readEntryValue, readHistoryEnvelope, writeEntryValue } from './navigationState';
type Target = { path: string; tag: string; label: string | null; name: string | null };
type Presentation = {
  focus?: Target;
  start?: number | null;
  end?: number | null;
  direction?: 'forward' | 'backward' | 'none' | null;
  innerTop?: number;
  innerLeft?: number;
};
let restoring = false;
let stopRestore: (() => void) | undefined;
let preparedEntry: string | undefined;
let interrupted = false;
// Listen before authentication/data hydration too: an early Tab or touch takes precedence.
if (typeof window !== 'undefined') {
  for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown', 'input']) {
    window.addEventListener(
      event,
      () => {
        if (!restoring) return;
        interrupted = true;
        stopRestore?.();
        restoring = false;
      },
      { capture: true, passive: true },
    );
  }
}
export function isRestoringNavigation(): boolean {
  return restoring;
}
export function describeNavigationTarget(element: Element | null): Target | undefined {
  const main = document.getElementById('main-content');
  if (!element || !main?.contains(element) || element === main) return;
  const parts: string[] = [];
  let current: Element | null = element;
  let anchor = '';
  while (current && current !== main) {
    const key = current.getAttribute('data-navigation-key');
    if (key) {
      anchor = '[data-navigation-key="' + CSS.escape(key) + '"]';
      break;
    }
    const parent: Element | null = current.parentElement;
    if (!parent) return;
    parts.unshift(
      current.tagName.toLowerCase() +
        ':nth-child(' +
        (Array.from(parent.children).indexOf(current) + 1) +
        ')',
    );
    current = parent;
  }
  return {
    path: anchor
      ? anchor + (parts.length ? ' > ' + parts.join(' > ') : '')
      : ':scope > ' + parts.join(' > '),
    tag: element.tagName,
    label: element.getAttribute('aria-label'),
    name: element.getAttribute('name'),
  };
}
export function findNavigationTarget(target?: Target): HTMLElement | null {
  if (!target) return null;
  try {
    const element = document
      .getElementById('main-content')
      ?.querySelector<HTMLElement>(target.path);
    return element &&
      element.tagName === target.tag &&
      element.getAttribute('aria-label') === target.label &&
      element.getAttribute('name') === target.name
      ? element
      : null;
  } catch {
    return null;
  }
}
export function captureRoutePresentation(entryKey?: string): void {
  if (restoring || !entryKey || readHistoryEnvelope()?.entryKey !== entryKey) return;
  const element = document.activeElement;
  const target = describeNavigationTarget(element);
  if (!target) return;
  const field =
    element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement ? element : null;
  const saved: Presentation = {
    focus: target,
    innerTop: element?.scrollTop,
    innerLeft: element?.scrollLeft,
  };
  if (field) {
    saved.start = field.selectionStart;
    saved.end = field.selectionEnd;
    saved.direction = field.selectionDirection;
  }
  writeEntryValue('presentation', saved, entryKey);
}
/** Native vertical containers (dialogs and text areas) have their own scroll offsets. */
export function captureDisclosure(event: Event): void {
  if (restoring || !(event.target instanceof HTMLDetailsElement)) return;
  const target = describeNavigationTarget(event.target);
  if (!target) return;
  const disclosures =
    readEntryValue<Record<string, { target: Target; open: boolean }>>('disclosures') ?? {};
  writeEntryValue('disclosures', {
    ...disclosures,
    [target.path]: { target, open: event.target.open },
  });
}
export function captureContainerScroll(event: Event): void {
  if (restoring || !(event.target instanceof HTMLElement)) return;
  const element = event.target;
  const target = describeNavigationTarget(element);
  if (!target || element.scrollHeight <= element.clientHeight) return;
  const containers =
    readEntryValue<Record<string, { target: Target; top: number }>>('containers') ?? {};
  writeEntryValue('containers', {
    ...containers,
    [target.path]: { target, top: element.scrollTop },
  });
}
export function prepareRoutePresentation(entryKey?: string): void {
  stopRestore?.();
  if (preparedEntry !== entryKey) interrupted = false;
  preparedEntry = entryKey;
  restoring = !interrupted;
}
/** Async layout can grow after mounting; explicit user input always cancels restoration. */
export function restoreRoutePresentation(y: number, entryKey?: string): void {
  stopRestore?.();
  if (interrupted && preparedEntry === entryKey) return;
  restoring = true;
  const saved = readEntryValue<Presentation>('presentation', entryKey);
  const containers =
    readEntryValue<Record<string, { target: Target; top: number }>>('containers', entryKey) ?? {};
  const disclosures =
    readEntryValue<Record<string, { target: Target; open: boolean }>>('disclosures', entryKey) ??
    {};
  let frame = 0;
  let settled: ReturnType<typeof setTimeout> | undefined;
  let focused: HTMLElement | null = null;
  let stopped = false;
  const main = document.getElementById('main-content');
  const stop = () => {
    if (stopped) return;
    stopped = true;
    restoring = false;
    cancelAnimationFrame(frame);
    resize?.disconnect();
    mutations?.disconnect();
    clearTimeout(timeout);
    clearTimeout(settled);
    if (stopRestore === stop) stopRestore = undefined;
  };
  const apply = () => {
    if (stopped || readHistoryEnvelope()?.entryKey !== entryKey) return;
    for (const item of Object.values(disclosures)) {
      const disclosure = findNavigationTarget(item.target);
      if (disclosure instanceof HTMLDetailsElement) disclosure.open = item.open;
    }
    const target = findNavigationTarget(saved?.focus);
    if (
      target &&
      target !== focused &&
      target.getClientRects().length &&
      !target.closest('[inert],[hidden],[aria-hidden="true"]') &&
      !target.matches(':disabled')
    ) {
      target.focus({ preventScroll: true });
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        saved?.start != null &&
        saved.end != null
      ) {
        try {
          target.setSelectionRange(saved.start, saved.end, saved.direction ?? undefined);
        } catch {
          /* Number inputs have no text selection API. */
        }
      }
      target.scrollTop = saved?.innerTop ?? 0;
      target.scrollLeft = saved?.innerLeft ?? 0;
      focused = target;
    }
    for (const item of Object.values(containers)) {
      const container = findNavigationTarget(item.target);
      if (container) container.scrollTop = item.top;
    }
    window.scrollTo(0, y);
    if (
      Math.abs(window.scrollY - y) < 1 &&
      (!saved?.focus || focused) &&
      document.fonts?.status !== 'loading'
    ) {
      clearTimeout(settled);
      settled = setTimeout(stop, 200);
    }
  };
  const schedule = () => {
    clearTimeout(settled);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  };
  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  const mutations = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;
  if (main) {
    resize?.observe(main);
    mutations?.observe(main, { childList: true, subtree: true });
  }
  const timeout = setTimeout(stop, 30000);
  stopRestore = stop;
  apply();
  schedule();
  void document.fonts?.ready.then(schedule);
}
