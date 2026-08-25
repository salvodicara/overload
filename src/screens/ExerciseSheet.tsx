import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { IconBack, IconPlay } from '../components/Icons';
import { NoteEditor } from '../components/NoteEditor';
import {
  exerciseName,
  getCatalog,
  italianInstructions,
  loadItalianInstructions,
  muscleGroup,
} from '../lib/exercises';
import { fmtDate, formatPreviousSet, previousSets } from '../lib/format';
import { exerciseJournal } from '../lib/notes';
import { trackingOf } from '../lib/types';
import { isAccountActionCurrent, useStore } from '../state/useStore';

export function ExerciseSheet({ id }: { id: string }) {
  const [, setItReady] = useState(false);
  const { t, i18n } = useTranslation();
  const catalogReady = useStore((s) => s.catalogReady);
  const workouts = useStore((s) => s.workouts);
  const notes = useStore((s) => s.notes);
  const unit = useStore((s) => s.settings.unit ?? 'kg');
  const nav = useStore((s) => s.nav);
  const queueTechniqueNote = useStore((s) => s.queueTechniqueNote);
  const saveTechniqueNote = useStore((s) => s.saveTechniqueNote);
  const [showVideo, setShowVideo] = useState(false);
  const [techniqueOpen, setTechniqueOpen] = useState(false);
  const [techniqueCommitting, setTechniqueCommitting] = useState(false);
  const committingTechnique = useRef(false);

  useEffect(() => {
    if (i18n.language.startsWith('it')) {
      void loadItalianInstructions().then(() => setItReady(true));
    }
  }, [i18n.language]);

  const ex = catalogReady ? getCatalog().get(id) : undefined;
  const isIt = i18n.language.startsWith('it');
  const name = ex ? (isIt ? ex.nameIt : ex.nameEn) : exerciseName(id, i18n.language);
  const altName = ex ? (isIt ? ex.nameEn : ex.nameIt) : '';
  const note = notes.find((item) => item.id === id);
  const latestWorkingSets = previousSets(workouts, id);
  const journal = exerciseJournal(workouts, note, id);
  const techniqueLabelId = 'exercise-technique-label';
  const techniqueContentId = 'exercise-technique-content';

  async function commitTechnique(text: string): Promise<void> {
    if (committingTechnique.current) return;
    committingTechnique.current = true;
    setTechniqueCommitting(true);
    try {
      const result = await saveTechniqueNote(id, text);
      if (isAccountActionCurrent(result)) setTechniqueOpen(false);
    } catch {
      // Keep the draft open when local persistence fails.
    } finally {
      committingTechnique.current = false;
      setTechniqueCommitting(false);
    }
  }

  return (
    <div className="screen">
      <header className="row" style={{ padding: '14px 0 10px' }}>
        <button className="iconbtn" aria-label={t('library.back')} onClick={() => history.back()}>
          <IconBack />
        </button>
      </header>

      {ex && <ExerciseMedia exercise={ex} size="hero" />}

      <div className="stack" style={{ marginTop: 14, gap: 6 }}>
        <h1 className="display" style={{ fontSize: 28 }}>
          {name}
        </h1>
        {altName && altName !== name && <div className="muted small">{altName}</div>}
      </div>

      {ex && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <span className="chip">{t(`library.muscle.${muscleGroup(ex)}`)}</span>
          {ex.equipment && <span className="chip">{ex.equipment}</span>}
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <h2 className="display" style={{ fontSize: 18, marginBottom: 8 }}>
          {t('notes.latestPerformance', { unit })}
        </h2>
        {latestWorkingSets.length > 0 ? (
          <div className="stack" style={{ gap: 4 }}>
            {latestWorkingSets.map((set, index) => (
              <div key={index} className="mono small">
                {trackingOf(set.tracking) === 'duration'
                  ? t('history.durationSet', { seconds: set.durationSec ?? 0 })
                  : trackingOf(set.tracking) === 'reps'
                    ? t('history.repsSet', { reps: set.reps })
                    : formatPreviousSet(set, set.tracking, unit)}
              </div>
            ))}
          </div>
        ) : (
          <div className="mono small muted">{t('workout.firstTime')}</div>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 id={techniqueLabelId} className="display" style={{ fontSize: 18, marginBottom: 8 }}>
          {t('notes.technique')}
        </h2>
        <div className="workout-note">
          <button
            type="button"
            className="workout-note__trigger"
            aria-expanded={techniqueOpen}
            aria-controls={techniqueContentId}
            disabled={techniqueCommitting}
            onClick={() => {
              if (!committingTechnique.current) setTechniqueOpen((open) => !open);
            }}
          >
            <span className="workout-note__copy">
              <span className="workout-note__scope">{t('notes.technique')}</span>
              <span className="workout-note__summary">
                {note?.technique || t('notes.techniquePlaceholder')}
              </span>
            </span>
            <span className="workout-note__chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          <div
            id={techniqueContentId}
            className="workout-note__content"
            role="group"
            hidden={!techniqueOpen}
          >
            {techniqueOpen && (
              <NoteEditor
                initial={note?.technique ?? ''}
                placeholder={t('notes.techniquePlaceholder')}
                labelledBy={techniqueLabelId}
                doneLabel={t('notes.done')}
                disabled={techniqueCommitting}
                onChangeText={(text) => queueTechniqueNote(id, text)}
                onDone={commitTechnique}
              />
            )}
          </div>
        </div>
      </section>

      {ex?.youtubeId && (
        <div style={{ marginTop: 16 }}>
          {showVideo ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: 'var(--r-card)',
                overflow: 'hidden',
                background: 'var(--surface2)',
              }}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ex.youtubeId}?autoplay=1&rel=0`}
                title={`${name} - ${t('library.watch')}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          ) : (
            <button className="btn btn-ghost btn-block" onClick={() => setShowVideo(true)}>
              <IconPlay width={13} height={13} style={{ verticalAlign: '-2px' }} />{' '}
              {t('library.watch')}
            </button>
          )}
        </div>
      )}

      {ex &&
        ex.instructions.length > 0 &&
        (() => {
          const steps = isIt ? (italianInstructions(ex.id) ?? ex.instructions) : ex.instructions;
          return (
            <section style={{ marginTop: 20, maxWidth: '65ch' }}>
              <h2 className="display" style={{ fontSize: 18, marginBottom: 8 }}>
                {t('library.howTo')}
              </h2>
              <ol style={{ paddingLeft: 22 }}>
                {steps.map((step, index) => (
                  <li key={index} style={{ lineHeight: 1.55, marginBottom: 10 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          );
        })()}

      {journal.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h2 className="display" style={{ fontSize: 18, marginBottom: 8 }}>
            {t('notes.journal')}
          </h2>
          <div className="stack" style={{ gap: 8 }}>
            {journal.map((entry) => {
              const content = (
                <>
                  <span className="mono muted" style={{ fontSize: 11 }}>
                    {fmtDate(entry.date, i18n.language)}
                  </span>
                  {entry.id.startsWith('legacy:') && (
                    <span className="chip">{t('notes.importedJournal')}</span>
                  )}
                  <span className="small" style={{ display: 'block', marginTop: 3 }}>
                    {entry.text}
                  </span>
                </>
              );
              return entry.id.startsWith('workout:') ? (
                <button
                  key={entry.id}
                  className="card"
                  style={{ minHeight: 44, padding: 10, textAlign: 'left' }}
                  onClick={() =>
                    nav({ view: 'workoutDetail', id: entry.id.slice('workout:'.length) })
                  }
                >
                  {content}
                </button>
              ) : (
                <div key={entry.id} className="card" style={{ padding: 10 }}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
