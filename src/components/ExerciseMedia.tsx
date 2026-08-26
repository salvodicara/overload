import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogExercise } from '../lib/exercises';
import { IconPause, IconPlay } from './Icons';

/**
 * Component-scoped CSS (tokens.css is owned elsewhere). React 19 hoists and
 * dedupes <style href precedence>, so rendering it per instance is free.
 */
const CSS = `
.exmedia {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  border-radius: var(--r-card);
  background: var(--surface2);
  overflow: hidden;
}
.exmedia img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Hero: whole demo frame stays visible, letterboxed on --surface2. */
  object-fit: contain;
}
.exmedia-b { opacity: 0; }
.exmedia--paused .exmedia-b { animation-play-state: paused; }
.exmedia-toggle {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  z-index: 1;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}
@media (prefers-reduced-motion: no-preference) {
  .exmedia-b { animation: exmedia-xfade 2.2s ease-in-out infinite; }
  @keyframes exmedia-xfade {
    0%, 34% { opacity: 0; }
    50%, 84% { opacity: 1; }
    100% { opacity: 0; }
  }
}
@media (prefers-reduced-motion: reduce) {
  .exmedia-toggle { display: none; }
}
.exmedia-thumb {
  flex: none;
  width: 56px;
  height: 56px;
  aspect-ratio: auto;
  border-radius: var(--r-control);
}
.exmedia-thumb img { object-fit: cover; }
.exmedia-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--muted);
}
`;

export function ExerciseMedia({
  exercise,
  size = 'hero',
}: {
  exercise: CatalogExercise;
  size?: 'thumb' | 'hero';
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const fail = (index: number) =>
    setFailed((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });

  const media = exercise.media ?? [];
  const available = media
    .map((src, index) => ({ index, src }))
    .filter(({ index }) => !failed.has(index))
    .slice(0, size === 'hero' ? 2 : 1);
  const showMotionControl = size === 'hero' && available.length === 2;
  const initial = (exercise.nameEn || exercise.nameIt || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      className={
        size === 'thumb'
          ? 'exmedia exmedia-thumb'
          : `exmedia${showMotionControl && paused ? ' exmedia--paused' : ''}`
      }
    >
      <style href="overload-exercise-media" precedence="default">
        {CSS}
      </style>
      {available.length > 0 ? (
        available.map(({ index, src }, position) => (
          <img
            key={index}
            className={position === 1 ? 'exmedia-b' : undefined}
            src={src}
            alt=""
            loading={size === 'hero' && position === 0 ? 'eager' : 'lazy'}
            fetchPriority={size === 'hero' && position === 0 ? 'high' : 'auto'}
            onError={() => fail(index)}
          />
        ))
      ) : (
        <div className="exmedia-fallback display" style={{ fontSize: size === 'thumb' ? 20 : 52 }}>
          {initial}
        </div>
      )}
      {showMotionControl && (
        <button
          className="exmedia-toggle"
          type="button"
          aria-label={t(paused ? 'library.resumeMedia' : 'library.pauseMedia')}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <IconPlay /> : <IconPause />}
        </button>
      )}
    </div>
  );
}
