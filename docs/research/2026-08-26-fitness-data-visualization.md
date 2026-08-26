# Fitness data visualization patterns for Overload

Date: 2026-08-26  
Scope: Home period navigation, KPI comparisons, previous exercise performance, and program accordion motion.  
Method: first-party product/help pages and platform guidance only.

## Executive decision

Overload should remove the visible previous/next arrow buttons from the Home period card and make the temporal surface directly swipeable. This is a familiar mobile-calendar interaction, not an anti-pattern, provided swipe is not the only route: keep the period label tappable for date selection, support keyboard/assistive navigation, expose an accessible announcement after the period changes, and provide a compact “Oggi” return affordance only when viewing the past.

The Home summary should become four glanceable KPI tiles. Each tile should show the current value as the dominant element and a small signed delta beside it, using an arrow plus sign and color rather than color alone. Remove the repeated prose sentence below the grid. Charts should remain secondary, simple, and metric-specific.

Exercise history should use the vocabulary and hierarchy established by Hevy, Strong, and Fitbod: “Ultima volta” for the recent set-by-set result, followed by separate access to trends, history, and records. During a workout, the comparison must be shown per set and, by default, come from the same routine/sheet context. “Ultima prestazione di lavoro · kg” is technically understandable but is not the clearest established label.

Program expansion should animate the content's height/clip and reposition following rows, with a synchronized chevron rotation and a subtle fade. The motion must be brief, interruptible, and removed or reduced under `prefers-reduced-motion`.

## Evidence

### 1. Period navigation: swipe-first is valid, swipe-only is not

- Apple treats swipe as a standard gesture for scrolling and navigation, and recommends familiar system gestures. It also explicitly says shortcut gestures should supplement, not replace, accessible actions. This supports removing persistent arrows from a compact calendar, but not removing all alternative controls. [Apple HIG: Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures/) · [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Apple Calendar on Watch uses left/right swipe to move between days and weeks, demonstrating direct temporal navigation on the calendar surface. [Apple Support: Calendar on Apple Watch](https://support.apple.com/en-sg/guide/watch/apd1b51754cc/watchos)
- Hevy's official calendar presents workout days as a chronological calendar, highlights trained dates, and makes those dates directly actionable. Its public help text does not establish hidden swipe as its only navigation mechanism, so Overload should copy the calendar's directness, not claim an exact Hevy gesture. [Hevy: Calendar and streaks](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features)
- Apple Health and Google Health both expose explicit Day/Week/Month/Year-style timeframe selectors for trends. This supports Overload's visible Settimana/Mese/Anno segmented control while leaving movement _within_ the selected scale to swipe. [Apple Support: Health data](https://support.apple.com/en-mide/guide/iphone/iphe3d379c32/ios) · [Google Health: Explore the app](https://support.google.com/googlehealth/answer/14237011?hl=en-CA)

**Recommendation for Overload**

1. Keep the `Settimana | Mese | Anno` selector visible.
2. Remove both arrow buttons.
3. Swipe left on the calendar/period panel for the next period and right for the previous period; track the content with the finger and settle to the new page.
4. Do not allow navigation beyond the current period.
5. When in the past, show a small textual `Oggi` action beside the period label; hide it for the current period.
6. Make the period label tappable to open a month/year picker; support keyboard Left/Right and screen-reader actions even though those controls are not visually rendered.
7. On first use, a one-time, dismissible edge cue is acceptable; do not permanently add instructional copy.

### 2. KPI deltas: current value first, comparison attached to it

- Fitbod's official Workout Report groups Total Workouts, Total Weight Lifted, Total Calories, and Total Duration into individual metric cards and places the comparison to the previous week/month/year on each card. This is the closest direct precedent for Overload. [Fitbod: Your Workout Report](https://help.fitbod.me/hc/en-us/articles/16436302450711-Your-Workout-Report)
- Apple Fitness encodes trend direction with an up/down arrow; the arrow, not color alone, communicates whether the metric is improving or declining. [Apple Support: Activity summary and trends](https://support.apple.com/en-euro/guide/iphone/iph4c34a8a95/ios)
- Apple HIG recommends making the data itself most prominent, keeping chart descriptions subordinate, avoiding reliance on color alone, and using simple, familiar chart types. It recommends bars for period totals and lines for change over time. [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts) · [Apple HIG: Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data)

**Recommendation for Overload**

Use a two-by-two KPI grid:

```text
3  ↗ +1          18  ↗ +4
allenamenti      serie

8.420 kg  ↗ +12%  147 min  ↘ −18
volume            durata
```

- Current value: largest type.
- Delta: immediately beside or just above the label, one typographic step smaller.
- Encoding: `↗ +N`, `↘ −N`, or `— 0`; always include the sign/arrow, with green/red/neutral as reinforcement.
- Comparison basis: same preceding period (`settimana precedente`, `mese precedente`, `anno precedente`) in the accessibility label and tooltip, not repeated as prose on screen.
- Prefer absolute deltas for count and duration; use a percentage for volume when the absolute number would dominate the tile. Avoid a percent when the previous value is zero; show `Nuovo`.
- Treat direction as change, not automatically “good” or “bad”. For training volume or duration, a decrease can be planned deloading; labels should say “in aumento/in calo,” not “meglio/peggio.”
- Keep a single chart below the KPIs with a metric selector. Use daily/weekly/monthly buckets for Week/Month/Year respectively. Avoid multiple simultaneous series and decorative gradients.

### 3. Previous exercise performance: “Ultima volta”, sets, then trends/history/records

- Hevy displays previous performance in a `PREVIOUS` column while logging, so every current set can be compared at a glance. It lets the user choose the last occurrence anywhere or the last occurrence in the same routine, and explicitly notes that same-routine values are more useful when strength and hypertrophy routines use different loads and reps. [Hevy: Previous workout values](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy)
- Strong separates exercise information into About, History, Charts, and Records; Records include all-time records, best performances at each rep count, and projected lifts. [Strong: Exercise detail](https://help.strongapp.io/article/237-about-exercise-detail)
- Fitbod's 2026 exercise-history redesign combines metric/timeframe trend charts with a Results tab containing exact weight and reps for every recent set plus records. [Fitbod: Exercise History and Records](https://fitbod.me/blog/exercise-history-and-records/)

**Recommendation for Overload**

- Rename the card title from `Ultima prestazione di lavoro · kg` to `Ultima volta`.
- Add a compact context line: `16 apr · A · Upper Heavy` (or the actual sheet/day). This is crucial because technique and comparison context live on the routine occurrence, not on the global exercise.
- Render sets compactly as `20 kg × 10`, `20 kg × 9`; include only completed working sets in the main row. Warm-up sets belong behind an optional disclosure.
- Show one restrained record badge only when relevant, such as `PR peso` or `PR 8RM`; do not mix lifetime records into the meaning of “last time.”
- Use a single `Vedi progressi` affordance to open a dedicated view with `Andamento | Risultati | Record`, following Fitbod/Strong's separation.
- In the live workout table, add a per-row `PREC.`/`PRECEDENTE` value. Default its source to the same routine/sheet occurrence because the same exercise can differ by program and day; optionally allow “qualsiasi allenamento” in settings, matching Hevy.

### 4. Accordion motion: animate the spatial relationship, not decoration

- Android's official Compose guidance uses `animateContentSize` for smooth size changes. Its `expandVertically`/`shrinkVertically` APIs animate clipped bounds and therefore move dependent layout naturally, which is exactly the mental model for an accordion. [Android Developers: Animation modifiers](https://developer.android.com/develop/ui/compose/animation/composables-modifiers) · [Android Developers: `expandVertically`](https://developer.android.com/reference/kotlin/androidx/compose/animation/package-summary)
- Apple recommends motion that is purposeful, brief, precise, consistent with the spatial action, and cancelable; frequent UI interactions should not be burdened by conspicuous animation. [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Apple requires motion alternatives and recommends responding to Reduce Motion; the web equivalent is `prefers-reduced-motion`. [Apple: Reduced Motion criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria) · [web.dev: `prefers-reduced-motion`](https://web.dev/articles/prefers-reduced-motion)

**Recommendation for Overload**

- Animate measured block height from `0` to content height and back, with `overflow: clip/hidden`; do not animate to/from `height: auto` without measuring or using a grid/content-size technique.
- Use a short ease-out expansion and slightly faster ease-in collapse (roughly 220–280 ms open, 180–240 ms close); exact duration should be tuned from screenshots/video at device speed, not treated as a brand token handed down by the cited platforms.
- Fade content from about 0 to 1 during the first part of opening and reverse on close; avoid scale, bounce, blur, or delayed child choreography.
- Rotate the chevron 180° over the same transition. The full program row remains the disclosure button; the ellipsis remains a separate options action.
- Keep content mounted until the close animation finishes, then remove it from layout and accessibility traversal.
- Under `prefers-reduced-motion: reduce`, make the state change effectively immediate and keep only the semantic expanded/collapsed state.

## What to copy, and what not to copy

Copy the established information architecture: visible timeframe selector, directly manipulable calendar, current KPI plus attached comparison, previous sets at the point of action, and separate History/Charts/Records. Do not cosmetically clone proprietary screens or use Apple screenshots/assets. The defensible target is the same interaction grammar with Overload's own visual system.
