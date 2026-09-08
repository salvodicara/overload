# Mobile visual craft — verification

The refinement preserves the established interaction model and Overload identity while improving the shared visual system:

- Neutral next-workout surface with a volt primary action, clear routine-detail chevron, sentence-case weekly heading and calendar-consistent date markers.
- Profile destinations share a single grouped-list grammar with icon/label/chevron. Identity and secondary statistics use quieter reading typography.
- Android-inspired selected navigation indicator, opaque lower navigation, rounded icon states and visible focus. Safe-area offsets continue to use the shared navigation-height token.
- Routine detail gives its full name an independent line below back/edit controls. Prescription, rest and technique notes are visibly grouped. Import is secondary to starting a routine.
- Home and Statistics numerals use the same tabular reading typography; units keep normal capitalization. History prose and metadata use the body typeface.

## Verification evidence

- 419 unit tests passed in 52 files.
- Full browser regression 134/134 passed; after the final focus/chevron/numeric-type correction, 25 relevant navigation, responsive, large-text and geometry scenarios passed again.
- Production build passed; 654 matching locale keys.
- 186 viewport captures: 31 states×EN/light320,EN/light390,IT/dark320,IT/dark390,IT/dark768,EN/light1280. No measured document overflow, JavaScript errors, untranslated keys or harness failures. Representative changed screens and neighboring editors/settings/exercise/active workout screens were visually inspected; not every capture received an individual visual judgment.
- Final confirmation 30 viewport captures plus 6 contrast measurements. Primary action contrast 12.35:1 light, 14.70:1 dark. Grouped Profile rows have 60px targets and verified solid inset keyboard focus.
- Independent review identified the grouped-list focus ring clipping; corrected with an inset outline. A suspected WorkoutEditor title clipping was not reproduced: scrollY 0, title top 8/bottom 58 within 66px header, visible overflow.
- Screenshot fixture data are synthetic. Physical Android PWA hardware, closed-app alarms and remote account synchronization were not exercised by this visual pass. Existing interaction/data behavior was preserved.

Local evidence: `~/Workspace/Codex/overload-qa/mobile-craft/`, `mobile-craft-confirm/`; logs `~/Workspace/Codex/mobile-craft-*.log`. The automated screenshot helper initially clicked away keyboard focus; the confirmation helper now preserves focus for that capture. This was a harness correction, not an additional product defect.

The quality objective is a coherent, carefully verified mobile interface. These results do not establish absolute perfection or replace a physical-device test.

## Release

Implementation `f2bf739` pushed to main and deployed to Firebase Hosting. Read-only production smoke passed: published assets match the final build, login renders, service worker is active,7,793 foods load online/offline, no document overflow or JavaScript errors. No personal training data was mutated.
