import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { IconBack } from '../components/Icons';
import { muscleGroup, searchExercises, type MuscleGroup } from '../lib/exercises';
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

export async function createCustomExerciseFlow(
  input: {
    name: string;
    muscleGroup: MuscleGroup;
    pickFor?: { routineId: string };
  },
  actions: Pick<Store, 'createCustomExercise' | 'addExerciseToRoutine' | 'nav'> & {
    close(): void;
  },
): Promise<AccountActionResult<string>> {
  const created = await actions.createCustomExercise(input.name, input.muscleGroup);
  if (!isAccountActionCurrent(created) || !created.value) return STALE_ACCOUNT_ACTION;
  const id = created.value;
  if (input.pickFor) {
    const added = await actions.addExerciseToRoutine(input.pickFor.routineId, id);
    if (!isAccountActionCurrent(added)) return STALE_ACCOUNT_ACTION;
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
  const catalogReady = useStore((s) => s.catalogReady);
  const nav = useStore((s) => s.nav);
  const addExerciseToRoutine = useStore((s) => s.addExerciseToRoutine);
  const createCustomExercise = useStore((s) => s.createCustomExercise);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('chest');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);

  const results = useMemo(
    () => (catalogReady ? searchExercises(query, group, i18n.language) : []),
    [catalogReady, query, group, i18n.language],
  );
  const shown = results.slice(0, MAX_RESULTS);

  async function pick(id: string): Promise<void> {
    if (!pickFor) {
      nav({ view: 'exercise', id });
      return;
    }
    const result = await addExerciseToRoutine(pickFor.routineId, id);
    if (!isAccountActionCurrent(result)) return;
    nav({ view: 'routineEditor', id: pickFor.routineId });
  }

  return (
    <div className="screen">
      {pickFor && (
        <div className="row" style={{ padding: '18px 0 0' }}>
          <button className="iconbtn" aria-label={t('common.back')} onClick={() => history.back()}>
            <IconBack />
          </button>
        </div>
      )}
      <div className="display screen-title" style={{ paddingTop: pickFor ? 6 : undefined }}>{t(pickFor ? 'library.pickTitle' : 'library.title')}</div>

      <div
        className="stack"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 8,
          background: 'var(--bg)',
          padding: '6px 0 10px',
        }}
      >
        <input
          type="search"
          value={query}
          placeholder={t('library.search')}
          aria-label={t('library.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div
          className="row"
          style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}
        >
          <button
            className={`chip${group === null ? ' chip-accent' : ''}`}
            style={{ padding: '7px 12px', fontSize: 12 }}
            aria-pressed={group === null}
            onClick={() => setGroup(null)}
          >
            {t('library.all')}
          </button>
          {GROUPS.map((g) => (
            <button
              key={g}
              className={`chip${group === g ? ' chip-accent' : ''}`}
              style={{ padding: '7px 12px', fontSize: 12 }}
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
            >
              {t(`library.muscle.${g}`)}
            </button>
          ))}
        </div>
      </div>

      {!catalogReady ? (
        <div className="stack">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card" style={{ height: 78, opacity: 0.5 }} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">{t('library.noResults')}</div>
      ) : (
        <div className="stack">
          {shown.map((ex) => (
            <button
              key={ex.id}
              className="card row"
              style={{ width: '100%', padding: 10, textAlign: 'left' }}
              onClick={() => void pick(ex.id)}
            >
              <ExerciseMedia exercise={ex} size="thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {i18n.language === 'it' ? ex.nameIt : ex.nameEn}
                </div>
                <span className="chip" style={{ display: 'inline-block', marginTop: 4 }}>
                  {t(`library.muscle.${muscleGroup(ex)}`)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => { setNewName(query); setCreating(true); }}>
        {t('library.create')}
      </button>

      {creating && (
        <div className="sheet-scrim" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="sheet card card-pad stack">
            <strong>{t('library.create')}</strong>
            <input
              autoFocus
              value={newName}
              placeholder={t('library.createNamePh')}
              aria-label={t('library.createNamePh')}
              style={{ fontFamily: 'inherit' }}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'calves'] as const).map((g) => (
                <button
                  key={g}
                  className={`chip${newGroup === g ? ' chip-accent' : ''}`}
                  style={{ padding: '7px 12px' }}
                  aria-pressed={newGroup === g}
                  onClick={() => setNewGroup(g)}
                >
                  {t(`library.muscle.${g}`)}
                </button>
              ))}
            </div>
            <button
              className="btn btn-accent btn-block"
              disabled={!newName.trim()}
              onClick={() => {
                void createCustomExerciseFlow(
                  { name: newName, muscleGroup: newGroup, pickFor },
                  {
                    createCustomExercise,
                    addExerciseToRoutine,
                    nav,
                    close: () => setCreating(false),
                  },
                );
              }}
            >
              {t('train.createConfirm')}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setCreating(false)}>
              {t('workout.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
