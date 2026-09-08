import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { IconBack } from '../components/Icons';
import { WorkoutList } from '../components/WorkoutList';
import { useCatalog } from '../hooks/useCatalog';
import { useSurfaceState } from '../hooks/useSurfaceState';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';
import { newestWorkoutFirst } from '../lib/workoutHistory';
import '../theme/history.css';

const PAGE_SIZE = 40;

function monthDays(anchor: string): string[] {
  const [year, month] = anchor.split('-').map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from(
    { length: count },
    (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
  );
}

export function History() {
  const { t, i18n } = useTranslation();
  const workouts = useStore((state) => state.workouts);
  const routines = useStore((state) => state.routines);
  const nav = useStore((state) => state.nav);
  const catalogReady = useCatalog();
  const [surface, setSurface] = useSurfaceState('history', {
    mode: 'list',
    anchor: new Date().toLocaleDateString('sv').slice(0, 7),
    query: '',
    routineId: '',
    exerciseId: '',
    visibleCount: PAGE_SIZE,
    selectedDay: null,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLElement>(null);
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const mode = surface.mode ?? 'list';
  const today = new Date().toLocaleDateString('sv');
  const anchor = surface.anchor ?? today.slice(0, 7);
  const query = (surface.query ?? '').trim().toLocaleLowerCase(i18n.language);
  const matching = useMemo(
    () =>
      workouts
        .filter((workout) => {
          if (surface.routineId && workout.routineId !== surface.routineId) return false;
          if (
            surface.exerciseId &&
            !workout.sets.some((set) => set.exerciseId === surface.exerciseId)
          )
            return false;
          if (!query) return true;
          const names = workout.sets
            .map((set) => exerciseName(set.exerciseId, i18n.language))
            .join(' ');
          return `${workout.dayLabel ?? ''} ${workout.note ?? ''} ${names}`
            .toLocaleLowerCase(i18n.language)
            .includes(query);
        })
        .sort(newestWorkoutFirst),
    [workouts, surface.routineId, surface.exerciseId, query, i18n.language, catalogReady],
  );
  const filtered =
    mode === 'calendar'
      ? matching.filter(
          (workout) =>
            workout.date.startsWith(`${anchor}-`) &&
            (!surface.selectedDay || workout.date === surface.selectedDay),
        )
      : matching;
  const dayCounts = new Map<string, number>();
  for (const workout of matching)
    dayCounts.set(workout.date, (dayCounts.get(workout.date) ?? 0) + 1);
  const visibleCount = surface.visibleCount ?? PAGE_SIZE;
  const visible = filtered.slice(0, visibleCount);
  const exerciseIds = [
    ...new Set(workouts.flatMap((workout) => workout.sets.map((set) => set.exerciseId))),
  ];
  useEffect(() => {
    const routineMissing = Boolean(
      surface.routineId && !routines.some((row) => row.id === surface.routineId),
    );
    const exerciseMissing = Boolean(
      surface.exerciseId && !exerciseIds.includes(surface.exerciseId),
    );
    if (routineMissing || exerciseMissing)
      setSurface((current) => ({
        ...current,
        ...(routineMissing ? { routineId: '' } : {}),
        ...(exerciseMissing ? { exerciseId: '' } : {}),
        visibleCount: PAGE_SIZE,
      }));
  }, [routines, workouts, surface.routineId, surface.exerciseId, setSurface]);
  const days = monthDays(anchor);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const firstWeekday = (new Date(`${days[0]}T12:00:00`).getDay() + 6) % 7;
  const moveMonth = (amount: number): void => {
    const [year, month] = anchor.split('-').map(Number);
    const next = new Date(year, month - 1 + amount, 1).toLocaleDateString('sv').slice(0, 7);
    setSurface((current) => ({
      ...current,
      anchor: next,
      selectedDay: null,
      visibleCount: PAGE_SIZE,
    }));
  };

  useEffect(() => {
    const target = sentinel.current;
    if (!target || visible.length >= filtered.length || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting)
          setSurface((current) => ({
            ...current,
            visibleCount: Math.min(
              (current.visibleCount ?? PAGE_SIZE) + PAGE_SIZE,
              filtered.length,
            ),
          }));
      },
      { rootMargin: '320px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible.length, filtered.length, setSurface]);

  return (
    <div className="screen page history-screen">
      <PageHeader
        title={t('history.title')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      <div className="history-toolbar">
        <div className="row seg" role="tablist" aria-label={t('history.view')}>
          {(['list', 'calendar'] as const).map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={mode === item}
              className={`seg-btn${mode === item ? ' on' : ''}`}
              onClick={() =>
                setSurface((current) => ({
                  ...current,
                  mode: item,
                  selectedDay: null,
                  visibleCount: PAGE_SIZE,
                }))
              }
            >
              {t(`history.${item}`)}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label={t('history.search')}
          placeholder={t('history.search')}
          value={surface.query ?? ''}
          onChange={(event) =>
            setSurface((current) => ({
              ...current,
              query: event.target.value,
              visibleCount: PAGE_SIZE,
            }))
          }
        />
        <div className="history-filters">
          <select
            aria-label={t('history.filterRoutine')}
            value={surface.routineId ?? ''}
            onChange={(event) =>
              setSurface((current) => ({
                ...current,
                routineId: event.target.value,
                visibleCount: PAGE_SIZE,
              }))
            }
          >
            <option value="">{t('history.allRoutines')}</option>
            {routines.map((routine) => (
              <option key={routine.id} value={routine.id}>
                {routine.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('history.filterExercise')}
            value={surface.exerciseId ?? ''}
            onChange={(event) =>
              setSurface((current) => ({
                ...current,
                exerciseId: event.target.value,
                visibleCount: PAGE_SIZE,
              }))
            }
          >
            <option value="">{t('history.allExercises')}</option>
            {exerciseIds.map((id) => (
              <option key={id} value={id}>
                {exerciseName(id, i18n.language)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'calendar' && (
        <section
          className="history-calendar"
          ref={calendarRef}
          aria-label={t('history.calendar')}
          tabIndex={0}
          onPointerDown={(event) => {
            suppressClick.current = false;
            if (!event.isPrimary || event.button !== 0) return;
            swipeStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
          }}
          onPointerMove={(event) => {
            const start = swipeStart.current;
            if (!start || start.id !== event.pointerId) return;
            const dx = Math.abs(event.clientX - start.x);
            const dy = Math.abs(event.clientY - start.y);
            if (dy > 12 && dy > dx) swipeStart.current = null;
          }}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!start || start.id !== event.pointerId) return;
            const distance = event.clientX - start.x;
            if (
              Math.abs(distance) >= 44 &&
              Math.abs(distance) > Math.abs(event.clientY - start.y) * 1.5
            ) {
              suppressClick.current = true;
              moveMonth(distance < 0 ? 1 : -1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              event.currentTarget.focus();
              moveMonth(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}
        >
          <div className="history-calendar__header">
            <button
              className="iconbtn"
              aria-label={t('history.previousMonth')}
              onClick={() => moveMonth(-1)}
            >
              <IconBack />
            </button>
            <h2 className="history-calendar__month" aria-live="polite" aria-atomic="true">
              {new Date(`${anchor}-01T12:00:00`).toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <button
              className="iconbtn history-calendar__next"
              aria-label={t('history.nextMonth')}
              onClick={() => moveMonth(1)}
            >
              <IconBack />
            </button>
          </div>
          <div className="history-calendar__tools">
            <span className="small muted">{t('history.calendarHint')}</span>
            <button
              className="history-calendar__today"
              onClick={() =>
                setSurface((current) => ({
                  ...current,
                  anchor: today.slice(0, 7),
                  selectedDay: null,
                  visibleCount: PAGE_SIZE,
                }))
              }
            >
              {t('home.today')}
            </button>
          </div>
          <div className="history-calendar__weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index}>
                {new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(
                  new Date(2026, 7, 24 + index),
                )}
              </span>
            ))}
          </div>
          <div key={anchor} className="history-calendar__grid">
            {Array.from({ length: firstWeekday }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}
            {days.map((day) => {
              const count = dayCounts.get(day) ?? 0;
              const selected = surface.selectedDay === day;
              return (
                <button
                  key={day}
                  className={[
                    selected && 'is-selected',
                    count > 0 && 'is-trained',
                    day === today && 'is-today',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${t('history.workoutsCount', { count })}`}
                  aria-pressed={selected}
                  aria-current={day === today ? 'date' : undefined}
                  onClick={() =>
                    setSurface((current) => ({
                      ...current,
                      selectedDay: current.selectedDay === day ? null : day,
                      visibleCount: PAGE_SIZE,
                    }))
                  }
                >
                  <span>{Number(day.slice(-2))}</span>
                  {count > 0 && <i aria-hidden="true">{count}</i>}
                </button>
              );
            })}
            {Array.from({ length: 42 - firstWeekday - days.length }, (_, index) => (
              <span key={`end-${index}`} aria-hidden="true" />
            ))}
          </div>
          <p className="history-calendar__scope" role="status">
            {surface.selectedDay
              ? t('history.dayScope', {
                  date: new Date(`${surface.selectedDay}T12:00:00`).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                  }),
                })
              : t('history.monthScope', {
                  month: new Date(`${anchor}-01T12:00:00`).toLocaleDateString(locale, {
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
          </p>
          {surface.selectedDay && (
            <button
              className="history-calendar__clear"
              onClick={() => {
                calendarRef.current
                  ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
                  ?.focus();
                setSurface((current) => ({
                  ...current,
                  selectedDay: null,
                  visibleCount: PAGE_SIZE,
                }));
              }}
            >
              {t('history.showWholeMonth')}
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="history-list">
        <h2 id="history-list" className="visually-hidden">
          {t('history.title')}
        </h2>
        {visible.length > 0 ? (
          <WorkoutList
            workouts={visible}
            onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })}
          />
        ) : (
          <div className="empty" role="status">
            {t(
              query || surface.routineId || surface.exerciseId
                ? 'history.noResults'
                : mode === 'calendar'
                  ? surface.selectedDay
                    ? 'history.emptyDay'
                    : 'history.emptyMonth'
                  : 'history.noResults',
            )}
          </div>
        )}
        <div ref={sentinel} className="history-sentinel" aria-hidden="true" />
      </section>
    </div>
  );
}
