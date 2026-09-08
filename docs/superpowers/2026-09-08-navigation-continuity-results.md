# Navigation continuity audit

## Findings and repairs

The saved route only retained the last primary tab; initialization overwrote deep history entries, and an active workout forced the workout screen on authentication hydration. Scroll offsets existed only in memory and excluded several detail/editor screens. Local form and panel state disappeared on remount. Workout actions changed the store route without updating browser history, and picker completion pushed duplicate editor entries.

- Initialize from the complete validated, account-owned history route, preserving routine/exercise IDs, picker destination, history mode and nutrition date/meal.
- Store per-entry, per-account working context in tab session storage: window and nested vertical scroll, focus/caret/selection, expanded disclosures, form drafts and non-destructive panels.
- Restore after React commits and layout becomes available. A slow catalog can finish before restoration settles; touch, wheel, typing or keyboard navigation cancels automatic restoration, including during authentication hydration.
- Remount screens by entry identity. Exercise lists use stable row identities for focus. Native calendar horizontal scrolling remains managed by its existing pager.
- Synchronize workout start, picker return, abandonment and completion with browser history. Preserve the exact originating editor entry when selecting an exercise.
- Preserve safe editing state across routine and workout editors, exercise journal, food editor/import, manual nutrition totals, measurements, calendar, routine creation and exercise creation. Existing durable workout/routine/note persistence remains authoritative.
- Clear successful submissions on their initiating entry, even if the user moved elsewhere during the request. Guard navigation and account ownership separately. Never replay a save or reopen a destructive confirmation/camera automatically.

## Verification

The initial three regression tests failed before the repairs: routine → exercise → refresh → Back, text/caret refresh, and exercise refresh during an active workout. They pass with the repair.

Additional browser coverage checks 23 route payloads, workout drafts through Back/Forward, picker history identity, nutrition values before blur and date isolation, custom food micronutrient expansion, creation-sheet focus restoration, slow catalog loading, and nested panel scrolling. Existing tests exercise native touch paging, filters, keyboard focus, destructive-action cancellation, active sessions, async failures and account switching.

Independent reviews found and resolved missing async guards, completed import snapshots, nested panel scrolling and summary cleanup targeting the wrong entry. The final core review found no actionable issue.

This establishes the tested refresh and Back/Forward behavior in Chromium mobile emulation. Physical Android PWA OS lifecycle, virtual-keyboard reopening and browser storage eviction remain device/browser behavior; this work does not claim mathematical perfection or restore records that were deleted.

References: [MDN History API](https://developer.mozilla.org/en-US/docs/Web/API/History), [scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration).

Final evidence: 424 unit tests passed in52 files; production build and654-key locale check passed. The complete browser run passed148 scenarios; its one failing new scenario used an incorrect exact button label. After correcting only that selector, all11 navigation regressions passed in a fresh run, including the inner-scroll scenario (149 distinct browser scenarios verified). The23-route refresh matrix is one of those regressions. No source changes followed the final complete run. Logs are stored outside the repository under `~/Workspace/Codex/navigation-*.log`.
