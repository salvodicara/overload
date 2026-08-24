import { useTranslation } from 'react-i18next';
import { useStore, type Route } from '../state/useStore';

const TABS: { view: Route['view']; key: string }[] = [
  { view: 'home', key: 'nav.workout' },
  { view: 'history', key: 'nav.history' },
  { view: 'progress', key: 'nav.progress' },
  { view: 'library', key: 'nav.library' },
  { view: 'settings', key: 'nav.settings' },
];

const GROUP: Partial<Record<Route['view'], Route['view']>> = {
  summary: 'home',
  workoutDetail: 'history',
  exercise: 'library',
  importExport: 'settings',
  routines: 'settings',
  routineEditor: 'settings',
};

export function Nav() {
  const { t } = useTranslation();
  const route = useStore((s) => s.route);
  const nav = useStore((s) => s.nav);
  if (route.view === 'workout') return null;
  const current = GROUP[route.view] ?? route.view;
  return (
    <nav className="nav" aria-label={t('app.name')}>
      <div className="nav-inner">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            className={`nav-btn${current === tab.view ? ' on' : ''}`}
            onClick={() => nav({ view: tab.view } as Route)}
            aria-current={current === tab.view ? 'page' : undefined}
          >
            <span className="nav-dot" />
            {t(tab.key)}
          </button>
        ))}
      </div>
    </nav>
  );
}
