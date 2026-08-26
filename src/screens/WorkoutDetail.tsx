import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { kindOf, trackingOf, type SetLog, type Workout } from '../lib/types';
import { displayVolume, formatWeight, weightLabel } from '../lib/units';
import { continueAccountAction, useStore } from '../state/useStore';

function fmtDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type ExerciseGroup = {
  exerciseId: string;
  sets: SetLog[];
  notes: string[];
};

/** Completed sets and exercise observations, in their first saved appearance order. */
function byExercise(workout: Workout): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const groupFor = (exerciseId: string): ExerciseGroup => {
    const existing = groups.find((group) => group.exerciseId === exerciseId);
    if (existing) return existing;
    const group = { exerciseId, sets: [], notes: [] };
    groups.push(group);
    return group;
  };

  for (const set of workout.sets) {
    if (set.done) groupFor(set.exerciseId).sets.push(set);
  }
  for (const note of workout.exerciseNotes ?? []) {
    groupFor(note.exerciseId).notes.push(note.text);
  }
  return groups;
}

export function WorkoutDetail({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const { workouts, catalogReady } = useStore();
  const unit = useStore((state) => state.settings.unit ?? 'kg');
  const nav = useStore((s) => s.nav);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const [confirming, setConfirming] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const workout = workouts.find((candidate) => candidate.id === id);
  if (!workout) {
    nav({ view: 'home' });
    return null;
  }
  void catalogReady; // re-render exercise names once the catalog resolves

  const groups = byExercise(workout);
  const workingSetCount = workout.sets.filter(
    (set) => set.done && kindOf(set.kind) === 'working',
  ).length;

  const setValue = (set: SetLog): string => {
    const tracking = trackingOf(set.tracking);
    if (tracking === 'duration') {
      return t('history.durationSet', { seconds: set.durationSec ?? 0 });
    }
    if (tracking === 'reps') return t('history.repsSet', { reps: set.reps });
    return t('history.weightRepsSet', {
      weight: formatWeight(set.weightKg, unit, i18n.language),
      reps: set.reps,
    });
  };

  const setGroup = (sets: SetLog[], kind: 'warmup' | 'working') => {
    if (sets.length === 0) return null;
    const heading = kind === 'warmup' ? t('history.warmupSets') : t('history.workingSets');
    return (
      <section style={{ marginTop: 10 }}>
        <h3 className="mono small muted">{heading}</h3>
        <div className="stack" style={{ gap: 4, marginTop: 4 }}>
          {sets.map((set, index) => (
            <div
              key={index}
              className="row mono small"
              aria-label={t(kind === 'warmup' ? 'history.warmupSet' : 'history.workingSet', {
                n: index + 1,
              })}
            >
              <span className="muted" style={{ minWidth: 18 }}>
                {kind === 'warmup' ? 'W' : index + 1}
              </span>
              <span>· {setValue(set)}</span>
              {set.isPr && (
                <span style={{ color: 'var(--good)', fontWeight: 700 }}>{t('history.pr')}</span>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="screen">
      <PageHeader
        className="workout-detail-header"
        title={
          <span style={{ color: workout.dayLabel ? undefined : 'var(--muted)' }}>
            {workout.dayLabel ?? t('nav.workout')}
          </span>
        }
        eyebrow={fmtDate(workout.date, i18n.language)}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />

      <div className="card card-pad spread">
        <div>
          <div className="mono small muted">{t('summary.volume')}</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            {displayVolume(workout.volumeKg, unit).toLocaleString(i18n.language)} {weightLabel(unit)}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="chip">{t('history.workingSetCount', { count: workingSetCount })}</span>
          {workout.source !== 'app' && <span className="chip">{t('history.imported')}</span>}
        </div>
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {groups.map((group) => {
          const warmups = group.sets.filter((set) => kindOf(set.kind) === 'warmup');
          const working = group.sets.filter((set) => kindOf(set.kind) === 'working');
          return (
            <section key={group.exerciseId} className="card card-pad">
              <h2 style={{ fontSize: 16 }}>
                <button
                  style={{ minWidth: 44, minHeight: 44, fontWeight: 700, textAlign: 'left' }}
                  onClick={() => nav({ view: 'exercise', id: group.exerciseId })}
                >
                  {exerciseName(group.exerciseId, i18n.language)}
                </button>
              </h2>
              {setGroup(warmups, 'warmup')}
              {setGroup(working, 'working')}
              {group.notes.length > 0 && (
                <section style={{ marginTop: 12 }}>
                  <h3 className="mono small muted">{t('notes.session')}</h3>
                  <div className="stack" style={{ gap: 6, marginTop: 4 }}>
                    {group.notes.map((text, index) => (
                      <p key={index} className="small">
                        {text}
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </section>
          );
        })}
      </div>

      {workout.note && (
        <section className="card card-pad" style={{ marginTop: 12 }}>
          <h2 className="mono small muted">
            {t(workout.source === 'app' ? 'history.overallNote' : 'history.importedWorkoutNote')}
          </h2>
          <p className="small" style={{ marginTop: 4 }}>
            {workout.note}
          </p>
        </section>
      )}

      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 20 }}
        onClick={() => setConfirming(true)}
      >
        {t('history.delete')}
      </button>

      {confirming && (
        <BottomSheet
          open
          title={t('history.delete')}
          initialFocusRef={cancelDeleteRef}
          onClose={() => setConfirming(false)}
        >
          <span className="muted small">{t('history.deleteBody')}</span>
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              void continueAccountAction(deleteWorkout(workout.id), () => nav({ view: 'home' }));
            }}
          >
            {t('history.deleteConfirm')}
          </button>
          <button
            ref={cancelDeleteRef}
            className="btn btn-ghost btn-block"
            onClick={() => setConfirming(false)}
          >
            {t('workout.cancel')}
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
