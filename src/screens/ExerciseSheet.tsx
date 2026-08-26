import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { IconBack, IconPlay } from '../components/Icons';
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
import { fmtDate, formatPreviousSet, previousSets } from '../lib/format';
import { exerciseJournal } from '../lib/notes';
import { trackingOf } from '../lib/types';
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
  const altName = ex ? (isIt ? ex.nameEn : ex.nameIt) : '';
  const note = notes.find((item) => item.id === id);
  const latestWorkingSets = previousSets(workouts, id);
  const latestTracking = trackingOf(latestWorkingSets[0]?.tracking);
  const latestPerformanceContext =
    latestTracking === 'weight_reps'
      ? unit
      : t(latestTracking === 'reps' ? 'editor.trackingReps' : 'editor.trackingDuration');
  const journal = exerciseJournal(workouts, note, id);

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
        {altName && altName !== name && <div className="muted small">{altName}</div>}
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
        <h2>{t('notes.latestPerformance', { unit: latestPerformanceContext })}</h2>
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
      </section>

      {journal.length > 0 && (
        <section className="exercise-detail__section">
          <h2>{t('notes.journal')}</h2>
          <ul className="exercise-journal">
            {journal.map((entry) => {
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
        </section>
      )}

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
