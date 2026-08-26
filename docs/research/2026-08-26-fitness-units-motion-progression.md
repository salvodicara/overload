# Fitness units, motion, and overload recommendations

Date: 2026-08-26  
Scope: weight × reps formatting, calendar/app motion, and competitor progressive-overload recommendations.  
Method: first-party help pages, official store media, and platform standards only.

## Executive recommendation

- In a standalone result, record, or history row, show the unit every time: `50 kg × 8` or `110 lb × 8`. Two letters remove a real ambiguity and are not excessive.
- In a dense input table, show the unit once in the weight column header (`kg` / `lb`) and keep cells numeric. In a chart, put the unit in the metric title, axis labels, or tooltip; do not append it decoratively to every nearby label.
- Adjacent calendar periods should behave like horizontal pages: content follows the finger, then the incoming period slides/fades from the correct temporal direction. A direct `Oggi` jump should not replay every skipped period; use one brief fade-through to the current period.
- Motion should explain hierarchy: adjacent time = horizontal shared axis; list/card → detail = directional/container transition; bottom-tab peers = restrained fade-through while navigation stays fixed; sheets = bottom slide; accordions = height/clip + opacity + chevron. Respect `prefers-reduced-motion` and keep every action usable without waiting for an animation.
- Hevy Trainer and Fitbod both advertise load/repetition recommendations based on performance history, but neither publishes its exact formula. Strong's official material describes comparison and tracking, not an automatic next-load prescription. Overload should therefore expose a transparent rationale for every suggested weight rather than pretending to reproduce an undisclosed algorithm.

## 1. How leading apps show weight × reps

### Hevy

Hevy's official Exercise History screenshot uses a `WEIGHT & REPS` column and renders each standalone set as `115lbs x 12 reps`, `255lbs x 7 reps`, and so on. Its summary chart also includes the unit in the current value and y-axis labels. This is direct evidence that Hevy considers the unit part of a self-contained historical result, not redundant chrome. [Hevy: Exercise Performance Tracking](https://help.hevyapp.com/hc/en-us/articles/35382889578135-Exercise-Performance-Tracking-in-Library-Weight-Bodyweight-Cardio-and-Duration-Based-Exercises)

Hevy also says the History tab contains the workout date and the completed sets, reps, and weights; records are separated into heaviest weight, 1RM, best-set volume, session volume, and set records. [Hevy: Exercise Performance Tracking](https://help.hevyapp.com/hc/en-us/articles/35382889578135-Exercise-Performance-Tracking-in-Library-Weight-Bodyweight-Cardio-and-Duration-Based-Exercises) · [Hevy: Personal and set records](https://help.hevyapp.com/hc/en-us/articles/35649367857175-Personal-Records-PRs-and-Set-Records-Explained-How-They-Work-in-the-Hevy-App)

### Strong

Strong's current official App Store screenshot takes the dense-table approach: columns are `Set | Previous | kg | Rep`, and rows contain bare values such as `16` and `8`. Strong's help also describes tapping the weight field as the `kg or lbs` field. The unit is explicit once in the local table context, not repeated in every cell. [Strong on the App Store](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577) · [Strong: Plate Calculator](https://help.strongapp.io/article/169-plate-calculator)

### Fitbod

Fitbod's official documentation consistently presents recommendations and examples with explicit units, such as `20 lbs` and `25 lbs per dumbbell x 10 reps`; its UI separates Sets, Reps, and Weight into named fields. It also treats weight, volume, reps, and estimated strength as distinct progress metrics. [Fitbod: Sets, reps, and weight](https://help.fitbod.me/hc/en-us/articles/29486697282711-Exercise-Details-Screen-Sets-Reps-and-Weight-Fields-Explained) · [Fitbod: Metrics & Records](https://help.fitbod.me/hc/en-us/articles/12732749777047-Fitbod-Metrics-Records)

### Decision for Overload

Use localized spacing and the real multiplication sign:

- Exercise detail, last performance, personal record, progress result row: `50 kg × 8`.
- Imperial equivalent: `110 lb × 8` (use the product's chosen singular unit token consistently; do not mix `lb` and `lbs` inside one locale).
- Live-workout grid: header `PESO (KG)` / `PESO (LB)` and numeric cells, because the repeated unit would add noise.
- Progress chart: `Peso massimo (kg)` plus `50 kg` in the selected-point tooltip. For a compact axis, a unit-bearing metric title is enough; if axis labels can be read outside that immediate context, include the unit there too.
- Volume remains a different quantity: `8.420 kg` as a total, never `50 kg × 8` unless describing one set.

This is slightly more typographically polished than Hevy's literal `255lbs x 7 reps`, while preserving the same information grammar.

## 2. Motion for calendars and the rest of the app

### Established platform grammar

- Apple says motion should be purposeful, brief, precise, consistent with the gesture's direction, cancelable, and never the only way to communicate state. Gestures need alternative input paths. [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion) · [Apple HIG: Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures/)
- Android calls sibling-screen swiping “horizontal paging.” Material's `SharedAxis X` transition is specifically a horizontal slide plus fade for screens with a spatial or navigational relationship, with direction tied to forward/back movement. [Android: Swipe views](https://developer.android.com/guide/navigation/advanced/swipe-view) · [Android: MaterialSharedAxis](https://developer.android.com/reference/com/google/android/material/transition/platform/MaterialSharedAxis)
- Material recommends Fade Through for UI elements without a strong spatial relationship. It sequentially fades outgoing and incoming content rather than showing both at full opacity. [Android: Material motion patterns](https://developer.android.com/codelabs/material-motion-android)
- Apple says Reduce Motion should replace x/y/z movement with fades where appropriate; W3C defines `prefers-reduced-motion` for removing or replacing nonessential motion, and its WCAG technique says interaction-triggered motion should be suppressed when requested unless essential. [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) · [W3C: Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion) · [W3C WCAG technique C39](https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html)

### Decision for Overload

1. **Swipe previous/next week, month, or year:** treat the calendar surface as a pager. Track drag displacement directly; on release, settle to the new period or spring back. Newer time enters from the right-to-left forward direction; older time reverses it. Animate the calendar and its KPIs as one bounded temporal surface, not the whole Home screen.
2. **Tap `Oggi`:** this is a discontinuous jump, not a request to watch every missing period pass. Use one brief fade-through from the viewed period to the current period, then remove or transform the `Oggi` affordance. This is an inference from Material's distinction between shared-axis and fade-through patterns; no cited competitor publishes a special “Today” transition specification.
3. **Bottom navigation:** keep the bar fixed; cross/fade-through only the destination content. Avoid lateral slides because tabs are peers, not a forward/back stack.
4. **Parent → child detail:** use a directional push or restrained container/shared-element transition anchored to the tapped row/card. Reverse it on Back so spatial causality is preserved.
5. **Bottom sheets and dialogs:** sheets rise from and return to the bottom edge; dialogs fade/scale subtly around their anchor. Do not combine blur, bounce, scale, and translation.
6. **Accordion/program expansion:** animate content height/clip, opacity, and chevron as one transition so following rows move continuously.
7. **Interruption:** navigation state must update immediately and accept a second gesture/tap while motion is running; avoid animation queues.
8. **Reduced motion:** replace calendar/page translation and container transforms with an effectively immediate fade/state swap; remove bounce and large-scale movement. Preserve the semantic state change and focus placement.

The platform sources intentionally emphasize purpose and relationship rather than prescribing one universal duration. Duration/easing must be tuned on the actual phone and verified by video or frame-by-frame screenshots, with the frequent calendar interaction kept deliberately short.

## 3. What competitors actually disclose about overload suggestions

### Hevy

Hevy's ordinary workout logger exposes previous values per set and can scope them either to the last occurrence anywhere or to the same routine. Hevy explicitly says same-routine comparison is useful when different routines use different weight and rep targets. [Hevy: Previous workout values](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy)

The newer Hevy Trainer advertises progressive-overload suggestions that tell the user **when** to increase weight and **by how much**, based on performance and an algorithm backed by research. The public article does not disclose thresholds, rounding, failure handling, or the mathematical formula. [Hevy: Trainer explained](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program)

### Fitbod

Fitbod discloses the input families, not a full formula. Recommendations use logged weight, reps, and sets; gradually increase weight or reps when an exercise is consistently easy; adjust when sets are difficult; vary intensity/volume through mStrength; use Estimated Strength and Max Effort Days; and incorporate manual edits plus RiR/exertion feedback. New-user recommendations start conservatively. [Fitbod: Understanding Fitbod & How It Works](https://help.fitbod.me/hc/en-us/sections/360001078993-Understanding-Fitbod-How-It-Works) · [Fitbod: Exercise Details](https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen)

### Strong

Strong's documented Focus Metric compares the current exercise with its previous occurrence using total volume, volume increase, weight/reps, reps, time, or distance. Its official training guidance emphasizes that the user remains in control and that Strong measures progress. In the official sources reviewed, Strong does not document an automatic “next weight” prescription comparable to Hevy Trainer or Fitbod. [Strong: Focus Metric](https://help.strongapp.io/article/226-focus-metric) · [Strong: Best way to train](https://help.strongapp.io/article/236-best-way-to-train)

### Product implication for Overload

“Previous” and “recommended” must remain different concepts:

- `Ultima volta: 50 kg × 8` is factual history.
- `Prossimo target: 52,5 kg × 6–8` is a recommendation and must state why, for example: `Hai completato tutte le serie al limite alto del range`.
- The comparison and technique context should default to the same routine occurrence, because Hevy recognizes that identical exercises can have different goals across routines, and Overload's domain model is even more precise: the same exercise can differ by day within one program.
- The UI should expose the data used (last relevant working sets, target rep range, completion/effort signal, configured increment) and never imply that a proprietary competitor formula was copied. If Overload currently lacks reliable RIR/RPE or completion-quality input, it should say so and use a conservative deterministic rule rather than manufacture confidence.
