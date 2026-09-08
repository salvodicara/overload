import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, type Route } from '../state/useStore';
import { IconBarbell, IconHome, IconUser } from './Icons';

const TABS: { view: Route['view']; key: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { view: 'home', key: 'nav.home', Icon: IconHome },
  { view: 'train', key: 'nav.workout', Icon: IconBarbell },
  { view: 'profile', key: 'nav.profile', Icon: IconUser },
];

const GROUP: Partial<Record<Route['view'], Route['view']>> = {
  history: 'profile',
  workoutDetail: 'profile',
  workoutEditor: 'profile',
  summary: 'home',
  routineEditor: 'train',
  exercise: 'profile',
  library: 'profile',
  progress: 'profile',
  body: 'profile',
  diet: 'profile',
  settings: 'profile',
  importExport: 'profile',
};

export function Nav() {
  const { t } = useTranslation();
  const route = useStore((s) => s.route);
  const nav = useStore((s) => s.nav);
  if (route.view === 'workout') return null;
  const current =
    route.view === 'library' && route.pickFor ? 'train' : (GROUP[route.view] ?? route.view);
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
              <tab.Icon
                width={21}
                height={21}
                strokeWidth={current === tab.view ? 2.4 : 2}
                aria-hidden
              />
            </span>
            <span className="nav-label">{t(tab.key)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
