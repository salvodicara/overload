import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';

export function RestBar() {
  const { t, i18n } = useTranslation();
  const restUntil = useStore((s) => s.restUntil);
  const restTotalSec = useStore((s) => s.restTotalSec);
  const restExerciseId = useStore((s) => s.restExerciseId);
  const stopRest = useStore((s) => s.stopRest);
  const startRest = useStore((s) => s.startRest);
  const route = useStore((s) => s.route);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!restUntil) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [restUntil]);

  if (!restUntil || route.view !== 'workout') return null;
  const left = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
  const label = restExerciseId ? exerciseName(restExerciseId, i18n.language) : '';

  return (
    <div className="restbar" role="timer" aria-live="off">
      <div className="restbar-inner" style={{ position: 'relative', paddingTop: 16 }}>
        {restTotalSec ? (
          <div className="rest-track">
            <div
              className="rest-fill"
              style={{ width: `${Math.max(0, Math.min(100, (left / restTotalSec) * 100))}%` }}
            />
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="small" style={{ opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('timer.rest')} · {label}
          </div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </div>
        </div>
        <button
          className="restbar-btn"
          onClick={() => restExerciseId && startRest(left + 15, restExerciseId)}
        >
          {t('timer.plus15')}
        </button>
        <button className="restbar-btn" onClick={stopRest}>
          {t('timer.skip')}
        </button>
      </div>
    </div>
  );
}
