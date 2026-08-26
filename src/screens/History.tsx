import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { useSurfaceState } from '../hooks/useSurfaceState';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';

const PAGE_SIZE = 40;

function monthDays(anchor: string): string[] {
  const [year, month] = anchor.split('-').map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) =>
    `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
  );
}

export function History() {
  const { t, i18n } = useTranslation();
  const workouts = useStore((state) => state.workouts);
  const routines = useStore((state) => state.routines);
  const nav = useStore((state) => state.nav);
  const [surface, setSurface] = useSurfaceState('history', {
    mode: 'list',
    anchor: new Date().toLocaleDateString('sv').slice(0, 7),
    query: '', routineId: '', exerciseId: '', visibleCount: PAGE_SIZE, selectedDay: null,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<number | null>(null);
  const mode = surface.mode ?? 'list';
  const query = (surface.query ?? '').trim().toLocaleLowerCase(i18n.language);
  const filtered = useMemo(() => workouts.filter((workout) => {
    if (surface.routineId && workout.routineId !== surface.routineId) return false;
    if (surface.exerciseId && !workout.sets.some((set) => set.exerciseId === surface.exerciseId)) return false;
    if (surface.selectedDay && workout.date !== surface.selectedDay) return false;
    if (!query) return true;
    const names = workout.sets.map((set) => exerciseName(set.exerciseId, i18n.language)).join(' ');
    return `${workout.dayLabel ?? ''} ${workout.note ?? ''} ${names}`.toLocaleLowerCase(i18n.language).includes(query);
  }), [workouts, surface.routineId, surface.exerciseId, surface.selectedDay, query, i18n.language]);
  const visibleCount = surface.visibleCount ?? PAGE_SIZE;
  const visible = filtered.slice(0, visibleCount);
  const exerciseIds = [...new Set(workouts.flatMap((workout) => workout.sets.map((set) => set.exerciseId)))];
  const anchor = surface.anchor ?? new Date().toLocaleDateString('sv').slice(0, 7);
  const days = monthDays(anchor);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const firstWeekday = (new Date(`${days[0]}T12:00:00`).getDay() + 6) % 7;
  const earliestMonth = workouts.reduce(
    (earliest, workout) => (workout.date.slice(0, 7) < earliest ? workout.date.slice(0, 7) : earliest),
    new Date().toLocaleDateString('sv').slice(0, 7),
  );
  const currentMonth = new Date().toLocaleDateString('sv').slice(0, 7);
  const moveMonth = (amount: number): void => {
    const [year, month] = anchor.split('-').map(Number);
    const next = new Date(year, month - 1 + amount, 1).toLocaleDateString('sv').slice(0, 7);
    if (next < earliestMonth || next > currentMonth) return;
    setSurface((current) => ({ ...current, anchor: next, selectedDay: null }));
  };

  useEffect(() => {
    const target = sentinel.current;
    if (!target || visible.length >= filtered.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setSurface((current) => ({
        ...current,
        visibleCount: Math.min((current.visibleCount ?? PAGE_SIZE) + PAGE_SIZE, filtered.length),
      }));
    }, { rootMargin: '320px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible.length, filtered.length, setSurface]);

  return (
    <div className="screen page history-screen">
      <PageHeader title={t('history.title')} />
      <div className="history-toolbar">
        <div className="row seg" role="tablist" aria-label={t('history.view')}>
          {(['list', 'calendar'] as const).map((item) => (
            <button key={item} role="tab" aria-selected={mode === item} className={`seg-btn${mode === item ? ' on' : ''}`}
              onClick={() => setSurface((current) => ({ ...current, mode: item, selectedDay: null }))}>
              {t(`history.${item}`)}
            </button>
          ))}
        </div>
        <input type="search" placeholder={t('history.search')} value={surface.query ?? ''}
          onChange={(event) => setSurface((current) => ({ ...current, query: event.target.value, visibleCount: PAGE_SIZE }))} />
        <div className="history-filters">
          <select aria-label={t('history.filterRoutine')} value={surface.routineId ?? ''}
            onChange={(event) => setSurface((current) => ({ ...current, routineId: event.target.value, visibleCount: PAGE_SIZE }))}>
            <option value="">{t('history.allRoutines')}</option>
            {routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
          </select>
          <select aria-label={t('history.filterExercise')} value={surface.exerciseId ?? ''}
            onChange={(event) => setSurface((current) => ({ ...current, exerciseId: event.target.value, visibleCount: PAGE_SIZE }))}>
            <option value="">{t('history.allExercises')}</option>
            {exerciseIds.map((id) => <option key={id} value={id}>{exerciseName(id, i18n.language)}</option>)}
          </select>
        </div>
      </div>

      {mode === 'calendar' && (
        <section
          className="history-calendar"
          aria-label={t('history.calendar')}
          tabIndex={0}
          onPointerDown={(event) => { swipeStart.current = event.clientX; }}
          onPointerUp={(event) => {
            if (swipeStart.current === null) return;
            const distance = event.clientX - swipeStart.current;
            swipeStart.current = null;
            if (Math.abs(distance) >= 44) moveMonth(distance < 0 ? 1 : -1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') moveMonth(-1);
            if (event.key === 'ArrowRight') moveMonth(1);
          }}
        >
          <h2 className="history-calendar__month">
            {new Date(`${anchor}-01T12:00:00`).toLocaleDateString(locale, {
              month: 'long', year: 'numeric',
            })}
          </h2>
          <div className="history-calendar__weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => <span key={index}>{new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 7, 24 + index))}</span>)}
          </div>
          <div className="history-calendar__grid">
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
            {days.map((day) => {
              const count = workouts.filter((workout) => workout.date === day).length;
              return <button key={day} className={surface.selectedDay === day ? 'is-selected' : ''} disabled={count === 0}
                onClick={() => setSurface((current) => ({ ...current, selectedDay: day, visibleCount: PAGE_SIZE }))}>
                <span>{Number(day.slice(-2))}</span>{count > 0 && <i aria-label={t('history.workoutsCount', { count })}>{count}</i>}
              </button>;
            })}
          </div>
          {surface.selectedDay && <button className="history-calendar__clear" onClick={() => setSurface((current) => ({ ...current, selectedDay: null }))}>{t('history.showWholeMonth')}</button>}
        </section>
      )}

      <section aria-labelledby="history-list">
        <h2 id="history-list" className="visually-hidden">{t('history.title')}</h2>
        {visible.length > 0 ? <WorkoutList workouts={visible} onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })} /> : <div className="empty">{t('history.noResults')}</div>}
        <div ref={sentinel} className="history-sentinel" aria-hidden="true" />
      </section>
    </div>
  );
}
