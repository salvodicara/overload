import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { IconBack, IconDown, IconPlay } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import {
  exerciseName,
  equipmentLabelKey,
  getCatalog,
  italianInstructions,
  loadItalianInstructions,
  muscleGroup,
} from '../lib/exercises';
import { fmtDate, formatPreviousSet, previousSets, previousWorkout } from '../lib/format';
import { exerciseJournal } from '../lib/notes';
import { kindOf, trackingOf } from '../lib/types';
import { useStore } from '../state/useStore';

export function ExerciseSheet({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const isIt = i18n.language.startsWith('it');
  const [itInstructionsReady, setItInstructionsReady] = useState(!isIt);
  const catalogReady = useStore((s) => s.catalogReady);
  const workouts = useStore((s) => s.workouts);
  const notes = useStore((s) => s.notes);
  const unit = useStore((s) => s.settings.unit ?? 'kg');
  const nav = useStore((s) => s.nav);
  const [showVideo, setShowVideo] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [visibleJournalEntries, setVisibleJournalEntries] = useState(5);

  useEffect(() => {
    if (!isIt) {
      setItInstructionsReady(true);
      return;
    }

    let active = true;
    setItInstructionsReady(false);
    void loadItalianInstructions().then(() => {
      if (active) setItInstructionsReady(true);
    });
    return () => {
      active = false;
    };
  }, [isIt]);

  const ex = getCatalog().get(id);
  const name = ex ? (isIt ? ex.nameIt : ex.nameEn) : exerciseName(id, i18n.language);
  const note = notes.find((item) => item.id === id);
  const latestWorkout = previousWorkout(workouts, id);
  const latestWorkingSets = previousSets(workouts, id);
  const latestTracking = trackingOf(latestWorkingSets[0]?.tracking);
  const journal = exerciseJournal(workouts, note, id);
  const completedWorkingSets = workouts.flatMap((workout) =>
    workout.sets.filter(
      (set) =>
        set.exerciseId === id &&
        set.done &&
        kindOf(set.kind) === 'working' &&
        trackingOf(set.tracking) === latestTracking,
    ),
  );
  const bestSet = completedWorkingSets.reduce<(typeof completedWorkingSets)[number] | undefined>(
    (best, set) => {
      if (!best) return set;
      const tracking = trackingOf(set.tracking);
      if (tracking === 'weight_reps') {
        return set.weightKg > best.weightKg ||
          (set.weightKg === best.weightKg && set.reps > best.reps)
          ? set
          : best;
      }
      const value = tracking === 'duration' ? (set.durationSec ?? 0) : set.reps;
      const bestValue = tracking === 'duration' ? (best.durationSec ?? 0) : best.reps;
      return value > bestValue ? set : best;
    },
    undefined,
  );
  const bestPerformance = bestSet
    ? trackingOf(bestSet.tracking) === 'duration'
      ? t('history.durationSet', { seconds: bestSet.durationSec ?? 0 })
      : trackingOf(bestSet.tracking) === 'reps'
        ? t('history.repsSet', { reps: bestSet.reps })
        : formatPreviousSet(bestSet, bestSet.tracking, unit)
    : null;

  if (!catalogReady && !ex) {
    return (
      <div className="screen exercise-detail">
        <PageHeader
          title={name}
          back={{ label: t('library.back'), icon: <IconBack />, onClick: () => history.back() }}
        />
        <div className="exercise-detail__loading" role="status" aria-busy="true">
          <span className="exercise-detail__loading-media" aria-hidden="true" />
          <span>{t('library.detailLoading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="screen exercise-detail">
      <PageHeader
        title={name}
        back={{ label: t('library.back'), icon: <IconBack />, onClick: () => history.back() }}
      />

      {ex && (ex.media?.length ?? 0) > 0 && (
        <div className="exercise-detail__media">
          <ExerciseMedia exercise={ex} size="hero" />
        </div>
      )}

      <div className="exercise-detail__identity">
        {ex && (
          <div className="exercise-detail__metadata">
            <span>{t(`library.muscle.${muscleGroup(ex)}`)}</span>
            {ex.equipment && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t(equipmentLabelKey(ex.equipment))}</span>
              </>
            )}
          </div>
        )}
      </div>

      <section className="exercise-detail__section exercise-detail__performance">
        <div className="exercise-performance-heading">
          <div>
            <h2>{t('notes.lastTime')}</h2>
            {latestWorkout && (
              <p className="exercise-performance-context mono small muted">
                <time dateTime={latestWorkout.date}>
                  {fmtDate(latestWorkout.date, i18n.language)}
                </time>
                {latestWorkout.dayLabel && <> · {latestWorkout.dayLabel}</>}
              </p>
            )}
          </div>
        </div>
        {latestWorkingSets.length > 0 ? (
          <ul className="exercise-performance-list">
            {latestWorkingSets.map((set, index) => (
              <li key={index} className="mono small">
                {trackingOf(set.tracking) === 'duration'
                  ? t('history.durationSet', { seconds: set.durationSec ?? 0 })
                  : trackingOf(set.tracking) === 'reps'
                    ? t('history.repsSet', { reps: set.reps })
                    : formatPreviousSet(set, set.tracking, unit)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mono small muted">{t('workout.firstTime')}</div>
        )}
        {bestPerformance && (
          <div className="exercise-performance-record mono small">
            <span>{t('notes.best')}</span>
            <strong>{bestPerformance}</strong>
          </div>
        )}
      </section>

      <button
        type="button"
        className="btn btn-ghost btn-block exercise-detail__progress-link"
        onClick={() => nav({ view: 'progress', exerciseId: id })}
      >
        {t('notes.openProgress')}
      </button>

      {ex && ex.instructions.length > 0 && (
        <section className="exercise-detail__section exercise-detail__instructions">
          <h2>{t('library.howTo')}</h2>
          {isIt && !itInstructionsReady ? (
            <div className="muted small" role="status" aria-busy="true">
              {t('library.instructionsLoading')}
            </div>
          ) : (
            <ol>
              {(isIt ? (italianInstructions(ex.id) ?? ex.instructions) : ex.instructions).map(
                (step, index) => (
                  <li key={index}>{step}</li>
                ),
              )}
            </ol>
          )}
        </section>
      )}

      {journal.length > 0 && (
        <section className="exercise-detail__section exercise-detail__journal">
          <div className="exercise-journal__heading">
            <h2 id="exercise-journal-title">{t('notes.journal')}</h2>
            <button
              type="button"
              className="exercise-journal__toggle"
              aria-expanded={journalOpen}
              aria-controls="exercise-journal-entries"
              aria-label={t('notes.journalEntries', { count: journal.length })}
              onClick={() => setJournalOpen((open) => !open)}
            >
              <span className="mono small muted">
                {t('notes.entryCount', { count: journal.length })}
              </span>
              <IconDown aria-hidden />
            </button>
          </div>
          {journalOpen && (
            <div id="exercise-journal-entries">
              <ul className="exercise-journal">
                {journal.slice(0, visibleJournalEntries).map((entry) => {
                  const imported = entry.id.startsWith('legacy:');
                  const content = (
                    <>
                      <span className="exercise-journal__topline">
                        <span className="mono muted">{fmtDate(entry.date, i18n.language)}</span>
                        {imported && (
                          <span className="exercise-journal__imported">
                            {t('notes.importedJournal')}
                          </span>
                        )}
                      </span>
                      <span className="exercise-journal__text">{entry.text}</span>
                    </>
                  );
                  return (
                    <li key={entry.id}>
                      {entry.id.startsWith('workout:') ? (
                        <button
                          type="button"
                          className="exercise-journal__entry exercise-journal__entry--linked"
                          onClick={() =>
                            nav({ view: 'workoutDetail', id: entry.id.slice('workout:'.length) })
                          }
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="exercise-journal__entry exercise-journal__entry--imported">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {visibleJournalEntries < journal.length && (
                <button
                  type="button"
                  className="btn btn-ghost btn-block exercise-journal__more"
                  onClick={() => setVisibleJournalEntries((count) => count + 5)}
                >
                  {t('notes.showMore')}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {ex?.youtubeId && (
        <section className="exercise-detail__video">
          {showVideo ? (
            <div className="exercise-detail__video-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ex.youtubeId}?autoplay=1&rel=0`}
                title={`${name} - ${t('library.watch')}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => setShowVideo(true)}
            >
              <IconPlay width={13} height={13} aria-hidden="true" /> {t('library.watch')}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
