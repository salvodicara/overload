import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, type Route } from '../state/useStore';
import { IconBarbell, IconChart, IconHistory, IconLibrary, IconUser } from './Icons';

const TABS: { view: Route['view']; key: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { view: 'home', key: 'nav.workout', Icon: IconBarbell },
  { view: 'history', key: 'nav.history', Icon: IconHistory },
  { view: 'progress', key: 'nav.progress', Icon: IconChart },
  { view: 'library', key: 'nav.library', Icon: IconLibrary },
  { view: 'settings', key: 'nav.settings', Icon: IconUser },
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
            <span className="nav-icon">
              <tab.Icon width={21} height={21} strokeWidth={current === tab.view ? 2.4 : 2} />
            </span>
            {t(tab.key)}
            <span className="nav-dot" />
          </button>
        ))}
      </div>
    </nav>
  );
}
