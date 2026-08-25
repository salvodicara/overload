import { IconBack, IconPlay } from '../components/Icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { exerciseName, getCatalog, italianInstructions, loadItalianInstructions, muscleGroup } from '../lib/exercises';
import { useStore } from '../state/useStore';
import type { Workout } from '../lib/types';

function lastTimeLine(workouts: Workout[], exerciseId: string): { date: string; sets: string } | null {
  for (const w of workouts) {
    const sets = w.sets.filter((s) => s.exerciseId === exerciseId && s.done);
    if (sets.length) {
      return { date: w.date, sets: sets.map((s) => `${s.weightKg}×${s.reps}`).join('  ') };
    }
  }
  return null;
}

export function ExerciseSheet({ id }: { id: string }) {
  const [, setItReady] = useState(false);
  const { t, i18n } = useTranslation();
  const catalogReady = useStore((s) => s.catalogReady);
  const workouts = useStore((s) => s.workouts);
  const notes = useStore((s) => s.notes);

  useEffect(() => {
    if (i18n.language.startsWith('it')) {
      void loadItalianInstructions().then(() => setItReady(true));
    }
  }, [i18n.language]);
  const [showVideo, setShowVideo] = useState(false);

  const ex = catalogReady ? getCatalog().get(id) : undefined;
  const isIt = i18n.language === 'it';
  const name = ex ? (isIt ? ex.nameIt : ex.nameEn) : exerciseName(id, i18n.language);
  const altName = ex ? (isIt ? ex.nameEn : ex.nameIt) : '';
  const last = lastTimeLine(workouts, id);

  return (
    <div className="screen">
      <div className="row" style={{ padding: '14px 0 10px' }}>
        <button className="iconbtn" aria-label={t('library.back')} onClick={() => history.back()}>
          <IconBack />
        </button>
      </div>

      {ex && <ExerciseMedia exercise={ex} size="hero" />}

      <div className="stack" style={{ marginTop: 14, gap: 6 }}>
        <div className="display" style={{ fontSize: 28 }}>
          {name}
        </div>
        {altName && altName !== name && <div className="muted small">{altName}</div>}
      </div>

      {ex && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <span className="chip">{t(`library.muscle.${muscleGroup(ex)}`)}</span>
          {ex.equipment && <span className="chip">{ex.equipment}</span>}
        </div>
      )}

      <div className="mono small muted" style={{ marginTop: 10 }}>
        {last ? t('workout.lastTime', { date: last.date.slice(5), sets: last.sets }) : t('workout.firstTime')}
      </div>

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
              <IconPlay width={13} height={13} style={{ verticalAlign: '-2px' }} /> {t('library.watch')}
            </button>
          )}
        </div>
      )}

      {ex && ex.instructions.length > 0 && (() => {
        const steps = i18n.language.startsWith('it') ? (italianInstructions(ex.id) ?? ex.instructions) : ex.instructions;
        return (
        <div style={{ marginTop: 20, maxWidth: '65ch' }}>
          <div className="display" style={{ fontSize: 18, marginBottom: 8 }}>
            {t('library.howTo')}
          </div>
          <ol style={{ paddingLeft: 22 }}>
            {steps.map((step, i) => (
              <li key={i} style={{ lineHeight: 1.55, marginBottom: 10 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
        );
      })()}
      {(() => {
        const note = notes.find((n) => n.id === id);
        if (!note || note.entries.length === 0) return null;
        return (
          <section style={{ marginTop: 20 }}>
            <div className="mono small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              {t('notes.title')}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {note.entries
                .slice()
                .reverse()
                .map((entry) => (
                  <div key={entry.date} className="small" style={{ borderLeft: '2px solid var(--line)', paddingLeft: 10 }}>
                    <span className="mono muted" style={{ fontSize: 11 }}>{entry.date}</span>
                    <div>{entry.text}</div>
                  </div>
                ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}
