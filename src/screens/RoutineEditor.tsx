import { IconBack, IconDown, IconUp, IconX } from '../components/Icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { toast, useStore } from '../state/useStore';
import type { Routine, RoutineDay, RoutineExercise } from '../lib/types';

const DIVIDER = { borderTop: '1px solid var(--line)' };
const SMALL_ICON = { width: 44, height: 44 } as const;

/** Validates a hand-written / exported routine file, normalising it to the `Routine` shape. */
function parseRoutine(json: string): Routine {
  const data: unknown = JSON.parse(json);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('invalid');
  const raw = data as Record<string, unknown>;
  if (typeof raw.name !== 'string' || !Array.isArray(raw.days) || raw.days.length === 0) {
    throw new Error('invalid');
  }
  const days: RoutineDay[] = raw.days.map((value) => {
    const day = value as Record<string, unknown>;
    if (
      typeof day?.label !== 'string' ||
      typeof day.name !== 'string' ||
      !Array.isArray(day.exercises)
    ) {
      throw new Error('invalid');
    }
    const exercises: RoutineExercise[] = day.exercises.map((entry) => {
      const x = entry as Record<string, unknown>;
      if (
        typeof x?.exerciseId !== 'string' ||
        typeof x.sets !== 'number' ||
        typeof x.repMin !== 'number' ||
        typeof x.restSec !== 'number'
      ) {
        throw new Error('invalid');
      }
      const exercise: RoutineExercise = {
        exerciseId: x.exerciseId,
        sets: x.sets,
        repMin: x.repMin,
        repMax: typeof x.repMax === 'number' ? x.repMax : null,
        restSec: x.restSec,
      };
      if (typeof x.note === 'string') exercise.note = x.note;
      if (typeof x.startWeightKg === 'number') exercise.startWeightKg = x.startWeightKg;
      if (typeof x.incrementKg === 'number') exercise.incrementKg = x.incrementKg;
      return exercise;
    });
    const parsed: RoutineDay = { label: day.label, name: day.name, exercises };
    if (typeof day.warmup === 'string') parsed.warmup = day.warmup;
    return parsed;
  });
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : crypto.randomUUID(),
    name: raw.name,
    days,
    updatedAt: 0,
  };
}

function NumField({
  label,
  value,
  step,
  fieldKey,
  onCommit,
}: {
  label: string;
  value: number | null | undefined;
  step: number;
  fieldKey: string;
  onCommit: (n: number | null) => void;
}) {
  return (
    <label className="stack" style={{ gap: 3 }}>
      <span
        className="mono muted"
        style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {label}
      </span>
      <input
        key={fieldKey}
        className="mono"
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        aria-label={label}
        defaultValue={value ?? ''}
        style={{ padding: '8px 4px', textAlign: 'center' }}
        onChange={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
}

export function RoutineEditor({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const routine = useStore((s) => s.routines.find((r) => r.id === id));
  const catalogReady = useStore((s) => s.catalogReady);
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);
  // Text/number inputs are uncontrolled (async saves would fight a controlled value), so rows are
  // remounted through this revision whenever a structural edit shifts them.
  const [rev, setRev] = useState(0);

  /** Mutates the freshest copy of the routine, then persists (store stamps `updatedAt` + syncs). */
  function commit(mutate: (draft: Routine) => void, structural = false): void {
    const current = useStore.getState().routines.find((r) => r.id === id);
    if (!current) return;
    const draft = structuredClone(current);
    mutate(draft);
    void saveRoutine(draft).then(() => {
      if (structural) setRev((v) => v + 1);
    });
  }

  function onRoutineFile(file: File): void {
    void file.text().then((text) => {
      let parsed: Routine;
      try {
        parsed = parseRoutine(text);
      } catch {
        toast(t('editor.invalid'));
        return;
      }
      void saveRoutine(parsed).then(() => {
        toast(t('editor.imported'));
        setRev((v) => v + 1);
        if (parsed.id !== id) nav({ view: 'routineEditor', id: parsed.id });
      });
    });
  }

  const back = (
    <button
      className="iconbtn"
      aria-label={t('common.back')}
      onClick={() => nav({ view: 'routines' })}
    >
      <IconBack />
    </button>
  );

  if (!routine) {
    return (
      <div className="screen">
        <div className="row" style={{ padding: '18px 0 6px' }}>
          {back}
        </div>
        <div className="empty">{t('editor.notFound')}</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row" style={{ padding: '18px 0 6px' }}>
        {back}
        <div className="display" style={{ fontSize: 26 }}>
          {t('editor.title')}
        </div>
      </div>

      <label className="stack" style={{ gap: 5, marginTop: 10 }}>
        <span className="mono small muted">{t('editor.name')}</span>
        <input
          key={`${rev}-${routine.id}`}
          aria-label={t('editor.name')}
          defaultValue={routine.name}
          style={{ fontFamily: 'var(--font-body)' }}
          onChange={(e) => commit((r) => void (r.name = e.target.value))}
        />
      </label>

      <div className="stack" style={{ marginTop: 16 }}>
        {routine.days.map((day, di) => (
          <div key={`${rev}-${di}`} className="card">
            <div className="card-pad row">
              <input
                aria-label={t('editor.dayLabel')}
                defaultValue={day.label}
                className="mono"
                style={{ width: 62, textAlign: 'center' }}
                onChange={(e) => commit((r) => void (r.days[di].label = e.target.value))}
              />
              <input
                aria-label={t('editor.dayName')}
                defaultValue={day.name}
                style={{ flex: 1, fontFamily: 'var(--font-body)' }}
                onChange={(e) => commit((r) => void (r.days[di].name = e.target.value))}
              />
              {routine.days.length > 1 && (
                <button
                  className="iconbtn"
                  aria-label={t('editor.removeDay')}
                  onClick={() => commit((r) => void r.days.splice(di, 1), true)}
                >
                  <IconX width={16} height={16} />
                </button>
              )}
            </div>

            {day.exercises.length === 0 && (
              <div className="card-pad small muted" style={DIVIDER}>
                {t('editor.noExercises')}
              </div>
            )}

            {day.exercises.map((rx, xi) => (
              <div key={`${rev}-${di}-${xi}`} className="card-pad" style={DIVIDER}>
                <div className="row">
                  <span
                    style={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                    className={catalogReady ? undefined : 'muted'}
                  >
                    {exerciseName(rx.exerciseId, i18n.language)}
                  </span>
                  <button
                    className="iconbtn"
                    style={SMALL_ICON}
                    aria-label={t('editor.moveUp')}
                    disabled={xi === 0}
                    onClick={() =>
                      commit((r) => {
                        const list = r.days[di].exercises;
                        [list[xi - 1], list[xi]] = [list[xi], list[xi - 1]];
                      }, true)
                    }
                  >
                    <IconUp width={16} height={16} />
                  </button>
                  <button
                    className="iconbtn"
                    style={SMALL_ICON}
                    aria-label={t('editor.moveDown')}
                    disabled={xi === day.exercises.length - 1}
                    onClick={() =>
                      commit((r) => {
                        const list = r.days[di].exercises;
                        [list[xi], list[xi + 1]] = [list[xi + 1], list[xi]];
                      }, true)
                    }
                  >
                    <IconDown width={16} height={16} />
                  </button>
                  <button
                    className="iconbtn"
                    style={SMALL_ICON}
                    aria-label={t('editor.removeExercise')}
                    onClick={() => commit((r) => void r.days[di].exercises.splice(xi, 1), true)}
                  >
                    <IconX width={16} height={16} />
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(50px, 1fr))',
                    gap: 5,
                    marginTop: 8,
                  }}
                >
                  <NumField
                    label={t('editor.sets')}
                    fieldKey={`${di}-${xi}-sets`}
                    value={rx.sets}
                    step={1}
                    onCommit={(n) => commit((r) => void (r.days[di].exercises[xi].sets = n ?? 0))}
                  />
                  <NumField
                    label={t('editor.repMin')}
                    fieldKey={`${di}-${xi}-repMin`}
                    value={rx.repMin}
                    step={1}
                    onCommit={(n) => commit((r) => void (r.days[di].exercises[xi].repMin = n ?? 0))}
                  />
                  <NumField
                    label={t('editor.repMax')}
                    fieldKey={`${di}-${xi}-repMax`}
                    value={rx.repMax}
                    step={1}
                    onCommit={(n) => commit((r) => void (r.days[di].exercises[xi].repMax = n))}
                  />
                  <NumField
                    label={t('editor.rest')}
                    fieldKey={`${di}-${xi}-restSec`}
                    value={rx.restSec}
                    step={15}
                    onCommit={(n) =>
                      commit((r) => void (r.days[di].exercises[xi].restSec = n ?? 0))
                    }
                  />
                  <NumField
                    label={t('editor.startWeight')}
                    fieldKey={`${di}-${xi}-startWeightKg`}
                    value={rx.startWeightKg}
                    step={0.5}
                    onCommit={(n) =>
                      commit((r) => {
                        const target = r.days[di].exercises[xi];
                        if (n === null) delete target.startWeightKg;
                        else target.startWeightKg = n;
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="row" style={{ borderTop: '1px dashed var(--line)' }}>
              <button
                className="addset"
                onClick={() => nav({ view: 'library', pickFor: { routineId: id, dayIndex: di } })}
              >
                {t('editor.addExercise')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-ghost btn-block"
        style={{ marginTop: 14 }}
        onClick={() =>
          commit((r) => {
            const label = String.fromCharCode(65 + (r.days.length % 26));
            r.days.push({ label, name: t('editor.dayDefault', { label }), exercises: [] });
          }, true)
        }
      >
        {t('editor.addDay')}
      </button>

      <label className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>
        <input
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onRoutineFile(file);
          }}
        />
        {t('editor.importJson')}
      </label>
    </div>
  );
}
