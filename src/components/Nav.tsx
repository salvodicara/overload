import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, type Route } from '../state/useStore';
import { IconBarbell, IconChart, IconHome, IconUser } from './Icons';

const TABS: { view: Route['view']; key: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { view: 'home', key: 'nav.home', Icon: IconHome },
  { view: 'train', key: 'nav.workout', Icon: IconBarbell },
  { view: 'progress', key: 'nav.progress', Icon: IconChart },
  { view: 'profile', key: 'nav.profile', Icon: IconUser },
];

const GROUP: Partial<Record<Route['view'], Route['view']>> = {
  workoutDetail: 'home',
  summary: 'home',
  routineEditor: 'train',
  library: 'profile',
  exercise: 'profile',
  settings: 'profile',
  importExport: 'profile',
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
              <tab.Icon width={22} height={22} strokeWidth={current === tab.view ? 2.4 : 2} />
            </span>
            {t(tab.key)}
            <span className="nav-dot" />
          </button>
        ))}
      </div>
    </nav>
  );
}
