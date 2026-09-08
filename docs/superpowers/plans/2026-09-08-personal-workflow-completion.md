# Personal workflow completion implementation plan

Goal: support the user's home/gym/review tasks with established patterns and verify truthful behavior.
Architecture: extend existing local-first store and screens. Dedicated additive plan format distinct from backups. Existing canonical workout history and exercise library remain shared.

- [x] Add strict plan parser, AI kit and additive atomic import action. Test malformed input, unknown catalog IDs, retry/double-import safety, account isolation and preservation of existing data.
- [x] Add Train → Import plan screen with file/paste, actionable validation, plan preview and explicit import. Use existing headers, buttons and fields; localize IT/EN.
- [x] Audit timer/persistence/duration with current platform documentation; implement reliable supported behavior and identify any platform choice required for suspended app alerts.
- [x] Complete the common daily-nutrient base with eight fields and past dates, preserving backup compatibility, missing-versus-zero semantics, decimal values and history.
- [ ] Await the user’s food/meal-diary preference and phone platform before dependent diary or native alert work.
- [x] Verify actual duration correction from seven hours to ninety minutes, technique/note navigation, records, attendance and restored session. Add targeted regressions for changes.
- [x] Freeze source, run unit/build/E2E, batched mobile visual checks, independent review, document evidence and remaining platform dependencies, commit.

Subagent-driven development used for independent bounded work; agents own named files and do not revert shared edits. Root integrates routes, localizations and tests after agent delivery. No editing source during final Vite E2E run.
