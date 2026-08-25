import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { muscleGroup, searchExercises, type MuscleGroup } from '../lib/exercises';
import type { TrackingType } from '../lib/types';
import {
  isAccountActionCurrent,
  STALE_ACCOUNT_ACTION,
  useStore,
  type AccountActionResult,
  type Store,
} from '../state/useStore';

const GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'calves'];

/** Long lists stay responsive on phones without a virtualiser. */
const MAX_RESULTS = 60;

type LibraryHistoryState = {
  library?: { query?: unknown; group?: unknown };
};

function readLibraryHistory(): { query: string; group: MuscleGroup | null } {
  if (typeof history === 'undefined') return { query: '', group: null };
  const saved = (history.state as LibraryHistoryState | null)?.library;
  const query = typeof saved?.query === 'string' ? saved.query : '';
  const group = GROUPS.includes(saved?.group as MuscleGroup) ? (saved?.group as MuscleGroup) : null;
  return { query, group };
}

export async function createCustomExerciseFlow(
  input: {
    name: string;
    muscleGroup: MuscleGroup;
    tracking?: TrackingType;
    pickFor?: { routineId: string };
  },
  actions: Pick<Store, 'createCustomExercise' | 'addExerciseToRoutine' | 'nav'> & {
    close(): void;
    isUiCurrent(): boolean;
  },
): Promise<AccountActionResult<string>> {
  const created = await actions.createCustomExercise(input.name, input.muscleGroup);
  if (!isAccountActionCurrent(created) || !created.value || !actions.isUiCurrent()) {
    return STALE_ACCOUNT_ACTION;
  }

  const id = created.value;
  if (input.pickFor) {
    const added = await actions.addExerciseToRoutine(
      input.pickFor.routineId,
      id,
      input.tracking ?? 'weight_reps',
    );
    if (!isAccountActionCurrent(added) || !actions.isUiCurrent()) return STALE_ACCOUNT_ACTION;
    actions.close();
    actions.nav({ view: 'routineEditor', id: input.pickFor.routineId });
  } else {
    actions.close();
    actions.nav({ view: 'exercise', id });
  }
  return created;
}

export function Library({ pickFor }: { pickFor?: { routineId: string } }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const catalogReady = useStore((s) => s.catalogReady);
  const nav = useStore((s) => s.nav);
  const addExerciseToRoutine = useStore((s) => s.addExerciseToRoutine);
  const createCustomExercise = useStore((s) => s.createCustomExercise);
  const initialHistory = useRef(readLibraryHistory()).current;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('chest');
  const [newTracking, setNewTracking] = useState<TrackingType>('weight_reps');
  const [query, setQuery] = useState(initialHistory.query);
  const [group, setGroup] = useState<MuscleGroup | null>(initialHistory.group);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const sheetGenerationRef = useRef(0);
  const submitGenerationRef = useRef<number | null>(null);
  const searchId = useId();
  const newNameId = useId();
  const newGroupId = useId();
  const newTrackingId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sheetGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const current = (history.state ?? {}) as Record<string, unknown>;
    history.replaceState({ ...current, library: { query, group } }, '');
  }, [group, query]);

  const results = useMemo(
    () => (catalogReady ? searchExercises(query, group, i18n.language) : []),
    [catalogReady, query, group, i18n.language],
  );
  const shown = results.slice(0, MAX_RESULTS);

  async function pick(id: string): Promise<void> {
    if (pendingPick) return;
    if (!pickFor) {
      nav({ view: 'exercise', id });
      return;
    }

    setOperationError(null);
    setPendingPick(id);
    try {
      const result = await addExerciseToRoutine(pickFor.routineId, id);
      if (!mountedRef.current || !isAccountActionCurrent(result)) return;
      nav({ view: 'routineEditor', id: pickFor.routineId });
    } catch {
      if (mountedRef.current) setOperationError(t('library.addError'));
    } finally {
      if (mountedRef.current) setPendingPick(null);
    }
  }

  function openCreateSheet(): void {
    sheetGenerationRef.current += 1;
    submitGenerationRef.current = null;
    setNewName(query);
    setNewGroup(group ?? 'chest');
    setNewTracking('weight_reps');
    setOperationError(null);
    setCreatePending(false);
    setCreating(true);
  }

  function dismissCreateSheet(): void {
    sheetGenerationRef.current += 1;
    submitGenerationRef.current = null;
    setOperationError(null);
    setCreatePending(false);
    setCreating(false);
  }

  async function submitCustomExercise(): Promise<void> {
    if (!newName.trim() || submitGenerationRef.current !== null) return;
    const generation = sheetGenerationRef.current;
    submitGenerationRef.current = generation;
    setOperationError(null);
    setCreatePending(true);

    const isUiCurrent = () =>
      mountedRef.current &&
      sheetGenerationRef.current === generation &&
      submitGenerationRef.current === generation;

    try {
      await createCustomExerciseFlow(
        {
          name: newName.trim(),
          muscleGroup: newGroup,
          tracking: newTracking,
          pickFor,
        },
        {
          createCustomExercise,
          addExerciseToRoutine,
          nav,
          isUiCurrent,
          close: () => {
            if (isUiCurrent()) setCreating(false);
          },
        },
      );
    } catch {
      if (isUiCurrent()) setOperationError(t('library.createError'));
    } finally {
      if (submitGenerationRef.current === generation) submitGenerationRef.current = null;
      if (mountedRef.current && sheetGenerationRef.current === generation) {
        setCreatePending(false);
      }
    }
  }

  return (
    <div className="screen library-screen">
      <PageHeader
        title={t(pickFor ? 'library.pickTitle' : 'library.title')}
        back={
          pickFor
            ? { label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }
            : undefined
        }
      />

      <div className="library-tools" role="search">
        <label className="field-label" htmlFor={searchId}>
          {t('library.searchLabel')}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder={t('library.search')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="library-filters" role="group" aria-label={t('library.muscleGroup')}>
          <button
            type="button"
            className="library-filter"
            aria-pressed={group === null}
            onClick={() => setGroup(null)}
          >
            {t('library.all')}
          </button>
          {GROUPS.map((muscle) => (
            <button
              key={muscle}
              type="button"
              className="library-filter"
              aria-pressed={group === muscle}
              onClick={() => setGroup(muscle)}
            >
              {t(`library.muscle.${muscle}`)}
            </button>
          ))}
        </div>
      </div>

      {operationError && !creating && (
        <div className="form-feedback form-feedback--error" role="alert">
          {operationError}
        </div>
      )}

      {!catalogReady ? (
        <div className="library-loading" role="status" aria-label={t('library.loading')}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="library-result library-result--skeleton" aria-hidden="true">
              <span className="library-result__thumb" />
              <span className="library-result__copy" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="library-empty">
          <p>{t('library.noResults')}</p>
          <p className="muted small">{t('library.noResultsHint')}</p>
        </div>
      ) : (
        <ul className="library-results" aria-label={t('library.results')}>
          {shown.map((exercise) => {
            const name = i18n.language.startsWith('it') ? exercise.nameIt : exercise.nameEn;
            const muscle = t(`library.muscle.${muscleGroup(exercise)}`);
            const equipmentId = `equipment-${exercise.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="library-result"
                  aria-label={`${name} ${muscle}`}
                  aria-describedby={exercise.equipment ? equipmentId : undefined}
                  disabled={pendingPick !== null}
                  onClick={() => void pick(exercise.id)}
                >
                  <ExerciseMedia exercise={exercise} size="thumb" />
                  <span className="library-result__body">
                    <span className="library-result__name">{name}</span>
                    <span className="library-result__meta">
                      <span>{muscle}</span>
                      {exercise.equipment && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span id={equipmentId}>{exercise.equipment}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-block library-create-action"
        onClick={openCreateSheet}
      >
        {t('library.create')}
      </button>

      <BottomSheet
        open={creating}
        title={t('library.create')}
        initialFocusRef={nameInputRef}
        closeOnScrim
        onClose={dismissCreateSheet}
      >
        <div className="form-field">
          <label className="field-label" htmlFor={newNameId}>
            {t('library.exerciseName')}
          </label>
          <input
            ref={nameInputRef}
            id={newNameId}
            value={newName}
            autoComplete="off"
            disabled={createPending}
            onChange={(event) => setNewName(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor={newGroupId}>
            {t('library.muscleGroup')}
          </label>
          <select
            id={newGroupId}
            value={newGroup}
            disabled={createPending}
            onChange={(event) => setNewGroup(event.target.value as MuscleGroup)}
          >
            {GROUPS.map((muscle) => (
              <option key={muscle} value={muscle}>
                {t(`library.muscle.${muscle}`)}
              </option>
            ))}
          </select>
        </div>

        {pickFor && (
          <div className="form-field">
            <label className="field-label" htmlFor={newTrackingId}>
              {t('library.trackingForRoutine')}
            </label>
            <select
              id={newTrackingId}
              value={newTracking}
              disabled={createPending}
              onChange={(event) => setNewTracking(event.target.value as TrackingType)}
            >
              <option value="weight_reps">{t('editor.trackingWeightReps')}</option>
              <option value="reps">{t('editor.trackingReps')}</option>
              <option value="duration">{t('editor.trackingDuration')}</option>
            </select>
            <p className="field-hint">{t('library.trackingHint')}</p>
          </div>
        )}

        {operationError && (
          <div className="form-feedback form-feedback--error" role="alert">
            {operationError}
          </div>
        )}

        <button
          type="button"
          className="btn btn-accent btn-block"
          disabled={!newName.trim() || createPending}
          onClick={() => void submitCustomExercise()}
        >
          {createPending ? t('library.creating') : t('train.createConfirm')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          disabled={createPending}
          onClick={dismissCreateSheet}
        >
          {t('workout.cancel')}
        </button>
      </BottomSheet>
    </div>
  );
}
