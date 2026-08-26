import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { beep, closeRestNotifications, notifyRestOver } from '../lib/audio';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';

/** Headless: fires the rest-over beep/notification wherever the user is. */
export function RestWatcher() {
  const { t, i18n } = useTranslation();
  const restUntil = useStore((s) => s.restUntil);
  const restExerciseId = useStore((s) => s.restExerciseId);
  const stopRest = useStore((s) => s.stopRest);
  const firedFor = useRef<number | null>(null);
  useCatalog(Boolean(restUntil && restExerciseId));

  useEffect(() => {
    const clearWhenVisible = (): void => {
      if (document.visibilityState === 'visible') void closeRestNotifications();
    };
    window.addEventListener('focus', clearWhenVisible);
    document.addEventListener('visibilitychange', clearWhenVisible);
    return () => {
      window.removeEventListener('focus', clearWhenVisible);
      document.removeEventListener('visibilitychange', clearWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!restUntil) return;
    const check = (): void => {
      if (Date.now() >= restUntil && firedFor.current !== restUntil) {
        firedFor.current = restUntil;
        beep();
        if (document.visibilityState === 'hidden') {
          void notifyRestOver(
            t('timer.rest'),
            restExerciseId ? exerciseName(restExerciseId, i18n.language) : t('app.name'),
          );
        }
        stopRest();
      }
    };
    check();
    document.addEventListener('visibilitychange', check);
    const id = setInterval(check, 250);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
    };
  }, [restUntil, restExerciseId, stopRest, t, i18n.language]);

  return null;
}
