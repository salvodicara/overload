# Navigation continuity

Owner asks refresh and Back/Forward to restore the exact screen and working context, including scroll and caret. This is an authorized repair of existing flows, not a new navigation model.

1. Persist the complete validated Route in the browser history entry; stop overwriting it with the last tab or forcing active workout on boot. Keep account ownership validation.
2. Give each history entry its own durable session snapshot (scroll, focus/selection, safe UI state/drafts). Capture before navigation and pagehide; restore after React and asynchronous layout readiness, cancel restoration when the user starts interacting.
3. Restore every route, including routine/editor/exercise/import details. Mount screen state by entry identity. Synchronize route changes from workout actions with actual browser history; return from pickers to their caller instead of pushing duplicate editors.
4. Persist only serializable reviewable UI state: drafts, search, pagination, expanded sections and non-destructive sheets. Never restore busy flags, destructive confirmations, camera permission requests or replay mutations. Clear submitted drafts.
5. Add regression tests that fail on current code: routine→exercise→reload→Back with scroll; active workout detail reload; text draft and caret reload; filter/detail/Back/Forward; different exercise entries; asynchronous catalog layout; account boundary. Audit screen-local states systematically.
6. Run unit, browser and production build checks; independent review; publish using existing authorization and perform read-only production/offline smoke. Record concrete evidence and any browser-imposed limitations.

Reference: browser History scrollRestoration and session-history state (MDN / HTML standard). Existing IndexedDB data remains authoritative; navigation snapshots are per-tab working context.
