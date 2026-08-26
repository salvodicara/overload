# Fitness app editor patterns

Updated: 2026-08-26

## Product rule

Overload must not invent interaction grammar for workout logging or editing. For every control in this flow, first adopt the shared convention below from Hevy, Strong, Fitbod, and StrengthLog; preserve Overload's visual identity only through typography, color, spacing, and motion. A deviation needs documented evidence that the established pattern cannot satisfy the use case.

## Directly observed evidence

| Concern | Hevy | Strong | Fitbod | StrengthLog |
|---|---|---|---|---|
| Completed workout editing | Workout detail → top-right `…` → **Edit Workout**; saved duration is edited through a focused scroll picker, then **Save**. | History → workout/top-right `…` → **Edit Workout** → **Save**. Date and start/end time are changed in a dedicated dialog, not three competing large fields. | Log → workout `…` for duration/delete/save-as-workout; tapping a logged workout/exercise allows sets, reps and weight edits. | The official logging guide documents a finish/save step where date/time, name, and comment are changed before Save. |
| Set rows | App Store screenshots show a dense table: **Set / Previous / kg / Reps / check**, with one compact row per set and **Add Set** directly below. | App Store screenshots show the same dense table grammar: **Set / Previous / kg / Rep / check**, compact numeric cells, and **Add Set** below. | Official screenshot shows a compact exercise detail table with set marker, reps, weight and a log/check action; fields are edited in place. | Official screenshot shows compact horizontal rows with set marker, weight and reps; the guide says a field is edited by tapping it and a set is completed from its set marker. |
| Exercise actions/removal | Exercise-level actions use `…`; structural workout changes can remain session-only or update the source routine at finish. | Exercise note and secondary actions are accessed through `…`; past-workout editing is entered from `…`. | Exercise `…` exposes replace/delete/instructions; long press is drag-and-drop reorder. Logged-workout deletion of an exercise is also under `…`. | Exercise `…` exposes stats/history/handle/change/delete; swipe offers history/change/delete; long press opens drag reorder. |
| Notes during an active workout | Separates persistent **routine note** from workout-specific note. The routine note appears while logging; the new workout note is editable and replaces the grey previous-session note. | Separates workout note, exercise note, and a persistent pinned note. Exercise notes are added from `…`; pinned cues are shown in a compact highlighted row. | Notes are secondary content under exercise detail → **More** → **Notes**, saved in a focused editor; history remains accessible separately. | Persistent technical cues are a **pinned exercise comment** below the exercise name, hideable with a comment icon and editable by long press. Session-specific feedback belongs to set/workout comments. |

Primary sources: [Hevy duration/editing](https://help.hevyapp.com/hc/en-us/articles/34513981310615-How-to-I-adjust-duration-and-pause-a-workout), [Hevy routine vs workout notes](https://help.hevyapp.com/hc/en-us/articles/34463684392983-How-do-the-exercise-notes-routine-and-workout-notes-work), [Hevy update routine vs keep original](https://help.hevyapp.com/hc/en-us/articles/38387296276375-Update-Routine-vs-Keep-Original-Routine), [Strong edit past workout](https://help.strongapp.io/article/249-how-do-i-edit-a-past-workout), [Strong date/start/end editing](https://help.strongapp.io/article/167-adjust-workout-date), [Strong notes](https://help.strongapp.io/article/134-adding-notes), [Fitbod editing](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod), [Fitbod exercise detail](https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen), [Fitbod notes](https://help.fitbod.me/hc/en-us/articles/21486783720087-Exercise-Notes), [StrengthLog logging](https://help.strengthlog.com/help-article/how-to-record-a-workout/), [StrengthLog active-workout shortcuts](https://help.strengthlog.com/help-article/shortcuts-in-an-active-workout/), [StrengthLog comments](https://help.strengthlog.com/help-article/exercise-comments/).

First-party App Store captures used for visual inspection are stored outside the repo in `/Users/salvatoredicara/Workspace/Codex/overload-competitor-research/`: `hevy-app-store-screenshots.png`, `strong-app-store-screenshots.png`, `fitbod-app-store-screenshots.png`, and `strengthlog-app-store-screenshots.png`. They are research evidence only and must not be shipped or copied into Overload. Listings: [Hevy](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350), [Strong](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577), [Fitbod](https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543), [StrengthLog](https://apps.apple.com/us/app/strengthlog-workout-tracker/id1434229662).

## Shared interaction grammar

These are repeated across multiple leaders and are therefore the default for Overload:

1. **Dense table for sets.** One header, one short row per set, numeric values edited in place, completion at the trailing edge, and a low-emphasis Add Set row. Do not wrap each set in a large card or tall form field.
2. **One clear primary action.** Back at leading edge; Save/Finish at trailing edge. Destructive and secondary exercise actions live under the conventional `…` menu rather than as a large persistent “Remove” button.
3. **Focused metadata editing.** Date, time, and duration use platform pickers or compact list rows that open focused controls. They must stack on narrow screens; they do not compete as three oversized text boxes in one row.
4. **Progressive disclosure for notes.** A compact cue/note row is visible when useful; editing opens a focused sheet/dialog/editor. Long text grows inside that editor. A large textarea is not permanently expanded in every exercise card.
5. **Different lifetimes remain distinct.** A routine/occurrence technique cue and a note about today's performance are different concepts. The UI labels and stores them separately even if they share one collapsed entry point.
6. **Direct manipulation for structure.** Long press + drag is the dominant reorder convention; `…` or swipe hosts replace/remove. Destructive actions remain explicit and confirm when data loss is material.

## Divergences worth preserving

- Hevy's routine note is not editable from an active workout, while the Overload requirement is to edit technique for the exact routine occurrence during the session. Preserve the familiar compact cue row, but let **Edit technique** open a focused sheet and apply it to that occurrence only.
- Fitbod often drills into a dedicated exercise screen; Hevy and Strong keep the logging table inline. Overload's long multi-exercise active workout should follow the inline Hevy/Strong table for speed, using a sheet only for secondary detail.
- StrengthLog exposes more swipe and long-press shortcuts. These can supplement visible `…` actions, but must not be the only way to discover removal or editing.

## Recommendation for Overload

For both active and completed-workout editing, use the Hevy/Strong set-table skeleton: compact exercise header with `…`, columns **Serie / Precedente / kg / Rip. / ✓**, approximately one touch-target-height row per set, then a quiet **+ serie** row. Put exercise removal/replacement/reorder in `…`; support long-press drag for reorder.

Keep workout metadata above the exercise list as compact, responsive rows: **Nome** full width; **Data**, **Ora di inizio**, and **Durata** as separate tappable rows/pickers that stack below the mobile breakpoint. Never allow native date/time intrinsic width to overlap a neighboring control.

Under each active exercise, show one collapsed **Tecnica e note** row. Expanded state shows two clearly localized rows—**Tecnica della scheda** and **Nota di oggi**—but opens a focused auto-growing editor only after the user taps one. This matches leaders' progressive disclosure while respecting Overload's occurrence-scoped technique model.

Acceptance is visual, not code-only: verify Italian and English screenshots at 320, 375, and 412 CSS px; no raw localization keys, overlap, clipped labels, uneven control heights, or expanded empty note areas.
