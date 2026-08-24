import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { version } from '../../package.json';
import { IconForward } from '../components/Icons';
import { signOutUser } from '../lib/firebase';
import { useStore } from '../state/useStore';
import { ExportRows } from './ImportExport';

const DIVIDER = { borderTop: '1px solid var(--line)' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div
        className="mono small muted"
        style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}
      >
        {title}
      </div>
      <div className="card">{children}</div>
    </section>
  );
}

export function Profile() {
  const { t, i18n } = useTranslation();
  const { workouts, user, syncState, settings } = useStore();
  const nav = useStore((s) => s.nav);
  const updateSettings = useStore((s) => s.updateSettings);

  const locale = settings.locale ?? (i18n.language.startsWith('it') ? 'it' : 'en');
  const totalVolume = workouts.reduce((a, w) => a + w.volumeKg, 0);

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
            {t('profile.workouts', { n: workouts.length })} ·{' '}
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

      <Section title={t('settings.title')}>
        <div className="card-pad spread">
          <span>{t('settings.language')}</span>
          <div className="row" style={{ gap: 6 }}>
            {(['it', 'en'] as const).map((l) => (
              <button
                key={l}
                className={`btn ${locale === l ? 'btn-accent' : 'btn-ghost'}`}
                style={{ padding: '9px 14px', fontSize: 14, minHeight: 40 }}
                aria-pressed={locale === l}
                onClick={() => void updateSettings({ locale: l })}
              >
                {t(`settings.${l}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="card-pad spread" style={DIVIDER}>
          <span>{t('settings.programStart')}</span>
          <input
            type="date"
            aria-label={t('settings.programStart')}
            value={settings.programStartDate ?? ''}
            style={{ width: 'auto' }}
            onChange={(e) => {
              if (e.target.value) void updateSettings({ programStartDate: e.target.value });
            }}
          />
        </div>
      </Section>

      <Section title={t('settings.data')}>
        <ExportRows />
        <button
          className="card-pad spread"
          style={{ ...DIVIDER, width: '100%', textAlign: 'left' }}
          onClick={() => nav({ view: 'importExport' })}
        >
          <span>{t('settings.import')}</span>
          <span className="muted"><IconForward aria-hidden /></span>
        </button>
        <div className="card-pad spread" style={DIVIDER}>
          <span>{t('settings.syncLabel')}</span>
          <span className="chip">{t(`settings.sync.${syncState}`)}</span>
        </div>
      </Section>

      <Section title={t('settings.about')}>
        <div className="card-pad stack">
          <div className="spread">
            <strong>{t('app.name')}</strong>
            <span className="mono small muted">{t('settings.version', { v: version })}</span>
          </div>
          <span className="muted small">{t('app.tagline')}</span>
          <span className="muted small">{t('settings.attribution')}</span>
        </div>
      </Section>

      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 22 }}
        onClick={() => void signOutUser()}
      >
        {t('settings.signOut')}
      </button>
    </div>
  );
}
