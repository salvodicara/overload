import { useTranslation } from 'react-i18next';
import { IconForward, IconLibrary } from '../components/Icons';
import { useStore } from '../state/useStore';

export function Profile() {
  const { t, i18n } = useTranslation();
  const { workouts, user, syncState } = useStore();
  const nav = useStore((s) => s.nav);
  const mine = workouts.filter((w) => w.source === 'app');
  const totalVolume = workouts.reduce((a, w) => a + w.volumeKg, 0);

  const rows = [{ key: 'library.title', view: 'library' as const, Icon: IconLibrary }];

  return (
    <div className="screen">
      <div className="display screen-title">{t('nav.profile')}</div>

      <div className="card card-pad row" style={{ gap: 14 }}>
        <span className="account-avatar" style={{ width: 52, height: 52, fontSize: 22 }}>
          {(user?.name ?? 'O').charAt(0).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{user?.name ?? t('app.name')}</div>
          <div className="mono small muted">
            {t('profile.workouts', { n: mine.length + (workouts.length - mine.length) })} ·{' '}
            {Math.round(totalVolume / 1000).toLocaleString(i18n.language)}t
          </div>
        </div>
        <span
          className="account-dot"
          title={t(`settings.sync.${syncState}`)}
          style={{
            background:
              syncState === 'synced'
                ? 'var(--good)'
                : syncState === 'error'
                  ? 'var(--danger)'
                  : 'var(--muted)',
          }}
        />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {rows.map(({ key, view, Icon }, i) => (
          <button
            key={view}
            className="spread card-pad"
            style={{
              width: '100%',
              textAlign: 'left',
              borderTop: i ? '1px solid var(--line)' : 'none',
              minHeight: 56,
            }}
            onClick={() => nav({ view })}
          >
            <span className="row" style={{ gap: 12 }}>
              <span className="muted" style={{ display: 'flex' }}>
                <Icon width={20} height={20} />
              </span>
              <span style={{ fontWeight: 600 }}>{t(key)}</span>
            </span>
            <span className="muted">
              <IconForward />
            </span>
          </button>
        ))}
      </div>

      <button
        className="card card-pad spread"
        style={{ width: '100%', textAlign: 'left', marginTop: 14, minHeight: 56 }}
        onClick={() => nav({ view: 'settings' })}
      >
        <span style={{ fontWeight: 600 }}>{t('settings.title')}</span>
        <span className="muted">
          <IconForward />
        </span>
      </button>
    </div>
  );
}
