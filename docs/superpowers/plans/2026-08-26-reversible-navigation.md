# Reversible Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the exact originating surface state when navigating back from any detail screen.

**Architecture:** Add one typed adapter around `history.state`, keyed per browser-history entry. Screens publish serializable snapshots through a focused hook; route restoration reads the matching snapshot and restores scroll after render.

**Tech Stack:** React 19, TypeScript, Zustand, browser History API, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-overload-workout-lifecycle-parity.md`

## Global Constraints

- Browser back, hardware back, and in-app back use the same history entries.
- Do not restore destructive confirmations, pointer state, animations, or toasts.
- Preserve Italian and English behavior and reduced-motion support.
- No new state-management dependency.

---

### Task 1: Typed history-entry snapshots

**Files:**
- Create: `src/lib/navigationState.ts`
- Test: `src/lib/__tests__/navigationState.test.ts`
- Modify: `src/state/useStore.ts`

**Interfaces:**
- Produces: `HistoryEnvelope`, `readHistoryEnvelope()`, `replaceSurfaceState(view, patch)`, `surfaceStateFor(view)`, `entryScrollKey(view)`, `writeEntryScroll(view, y)`, `readEntryScroll(view)`.
- Consumes: existing `Route` union from `src/state/useStore.ts`.

- [ ] **Step 1: Write failing adapter tests**

```ts
it('merges a Home snapshot without dropping the route or entry key', () => {
  history.replaceState({ route: { view: 'home' }, entryKey: 'a' }, '');
  replaceSurfaceState('home', { periodUnit: 'month', periodAnchor: '2026-05-01' });
  expect(readHistoryEnvelope()).toMatchObject({
    route: { view: 'home' },
    entryKey: 'a',
    surfaces: { home: { periodUnit: 'month', periodAnchor: '2026-05-01' } },
  });
});

it('keeps scroll separate for two entries of the same view', () => {
  writeEntryScroll('home', 420, 'entry-a');
  writeEntryScroll('home', 20, 'entry-b');
  expect(readEntryScroll('home', 'entry-a')).toBe(420);
});
```

- [ ] **Step 2: Run `pnpm vitest run src/lib/__tests__/navigationState.test.ts` and verify missing exports fail**

- [ ] **Step 3: Implement the minimal adapter**

```ts
export type HomeSurfaceState = {
  periodUnit?: 'week' | 'month' | 'year';
  periodAnchor?: string;
  chartMetric?: 'workouts' | 'workingSets' | 'volume' | 'durationMin';
  selectedDay?: string | null;
};

export type SurfaceStateMap = {
  home: HomeSurfaceState;
  history: { mode?: 'list' | 'calendar'; anchor?: string; query?: string; routineId?: string; exerciseId?: string; visibleCount?: number };
  library: { query?: string; group?: string | null; visibleCount?: number };
  progress: { section?: string; exerciseId?: string; metric?: string; range?: string };
  train: { openProgramId?: string | null };
};

export type HistoryEnvelope = {
  route: Route;
  entryKey: string;
  surfaces?: Partial<SurfaceStateMap>;
};
```

- [ ] **Step 4: Replace `scrollMemory` keyed only by view with entry-keyed scroll helpers and preserve the current envelope when pushing a detail route**

- [ ] **Step 5: Run the focused test and `pnpm vitest run src/lib/__tests__/appShell.test.tsx`; expect PASS**

- [ ] **Step 6: Commit `feat: preserve state per navigation entry`**

### Task 2: Surface snapshot hooks

**Files:**
- Create: `src/hooks/useSurfaceState.ts`
- Modify: `src/screens/Home.tsx`
- Modify: `src/screens/History.tsx`
- Modify: `src/screens/Library.tsx`
- Modify: `src/screens/Progress.tsx`
- Modify: `src/screens/Train.tsx`
- Test: `src/lib/__tests__/homeWeek.test.ts`

**Interfaces:**
- Consumes: `surfaceStateFor`, `replaceSurfaceState` from Task 1.
- Produces: `useSurfaceState<K>(view: K, defaults: SurfaceStateMap[K])` returning `[state, setState]`.

- [ ] **Step 1: Add failing Home initialization tests for month/year anchors serialized as `YYYY-MM-DD`**
- [ ] **Step 2: Run `pnpm vitest run src/lib/__tests__/homeWeek.test.ts`; expect FAIL on missing restoration helper**
- [ ] **Step 3: Implement `useSurfaceState` with one initial read and `history.replaceState` updates**

```ts
export function useSurfaceState<K extends keyof SurfaceStateMap>(
  view: K,
  defaults: SurfaceStateMap[K],
): [SurfaceStateMap[K], Dispatch<SetStateAction<SurfaceStateMap[K]>>] {
  const [state, setState] = useState(() => ({ ...defaults, ...surfaceStateFor(view) }));
  useEffect(() => replaceSurfaceState(view, state), [view, state]);
  return [state, setState];
}
```

- [ ] **Step 4: Move Home period unit, anchor, selected day, and chart metric into the hook; leave drag and motion transient**
- [ ] **Step 5: Move History filters/mode, Library query/group/visible count, Progress selection, and Train accordion into the same hook; delete Library's ad-hoc `history.replaceState` implementation**
- [ ] **Step 6: Run `pnpm test` and `pnpm build`; expect PASS**
- [ ] **Step 7: Commit `feat: restore navigation state across app surfaces`**

### Task 3: Universal back-navigation regression

**Files:**
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: restored surface state and entry-keyed scroll from Tasks 1-2.
- Produces: user-level contract for Home, Library, Train, Progress, and History.

- [ ] **Step 1: Add failing Playwright cases that open details from old week, month, and year views, call `page.goBack()`, and assert period label, selector, chart metric, and scroll are unchanged**
- [ ] **Step 2: Add representative Library query/filter, Train accordion, Progress selection, and History filter round trips**
- [ ] **Step 3: Run `pnpm e2e --grep "restores originating surface"`; verify at least the Home case fails before implementation is complete**
- [ ] **Step 4: Fix only integration defects revealed by these tests; do not introduce screen-specific back handlers**
- [ ] **Step 5: Run `pnpm e2e --grep "restores originating surface"`, `pnpm test`, and `pnpm build`; expect PASS**
- [ ] **Step 6: Commit `test: cover reversible navigation across surfaces`**
