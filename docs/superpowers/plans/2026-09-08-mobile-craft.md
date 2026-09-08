# Mobile craft implementation plan

**Goal:** Elevate the existing mobile visual system without replacing workout interaction grammar or the graphite/volt Archivo identity.
**Architecture:** Refine incumbent theme rules and screen markup; no new UI library, domain model, data migration or navigation destinations. Work in the existing isolated UX worktree. Owner explicitly authorized autonomous design choices and release.
**Spec:** PRODUCT.md plus the owner's latest request for a substantially more premium mobile experience.

- [x] Refine shared tokens and controls: selected navigation indicator using Android Material navigation convention; round icon button states; reading typography for secondary prose, consistent content spacing and opaque navigation surface.
- [x] Home: neutral next-workout surface, accent primary action, balanced type scale; full-width Statistics row; week dates use the same circle grammar as History.
- [x] Profile: one grouped list of the five existing destinations with consistent icon, label and chevron; quieter identity block.
- [x] Routine preview: back/edit toolbar above a full-width wrapping title; visible separation before exercise cards; clear grouping of prescription, rest and notes. Train: make import a secondary text action and refine row rhythm.
- [x] Preserve active set table geometry, dialog focus behavior, imports, nutrition calculations and existing route structure. No functional tests that merely mirror CSS; use existing regression tests plus rendered geometry/contrast checks.
- [x] One batched mobile/tablet/desktop visual check, all screen roles, EN/light and IT/dark, narrow/normal phone, empty/populated, keyboard focus and large-text samples. Fix concrete defects, then one confirmation pass.
- [x] Independent review; build, unit and full browser regression.
- [x] Commit, push, deploy and read-only production/offline smoke.

References: Hevy workout logging https://www.hevyapp.com/features/track-workouts/ and previous values https://www.hevyapp.com/features/track-exercises/; Strong routine workflow https://help.strongapp.io/article/229-my-first-workout; Android navigation active indicator https://github.com/material-components/material-components-android/blob/master/docs/components/BottomNavigation.md. References guide interaction grammar; the visual refinement uses Overload's own identity.
