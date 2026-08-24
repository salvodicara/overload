import { IconBack, IconForward } from '../components/Icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { version } from '../../package.json';
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

export function Settings() {
  const { t, i18n } = useTranslation();
  const settings = useStore((s) => s.settings);
  const syncState = useStore((s) => s.syncState);
  const user = useStore((s) => s.user);
  const nav = useStore((s) => s.nav);
  const updateSettings = useStore((s) => s.updateSettings);

  const locale = settings.locale ?? (i18n.language.startsWith('it') ? 'it' : 'en');

  return (
    <div className="screen">
      <div className="row" style={{ padding: '18px 0 0' }}>
        <button className="iconbtn" aria-label={t('common.back')} onClick={() => nav({ view: 'profile' })}>
          <IconBack />
        </button>
      </div>
      <div className="display screen-title" style={{ paddingTop: 6 }}>{t('settings.title')}</div>

      <div className="card">
        <div className="card-pad spread">
          <span>{t('settings.language')}</span>
          <div className="row" style={{ gap: 6 }}>
            {(['it', 'en'] as const).map((l) => (
              <button
                key={l}
                className={`btn ${locale === l ? 'btn-accent' : 'btn-ghost'}`}
                style={{ padding: '9px 14px', fontSize: 14 }}
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
      </div>

      <Section title={t('settings.data')}>
        <ExportRows />
        <button
          className="card-pad spread"
          style={{ ...DIVIDER, width: '100%', textAlign: 'left' }}
          onClick={() => nav({ view: 'importExport' })}
        >
          <span>{t('settings.import')}</span>
          <span className="muted"><IconForward /></span>
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

      {user?.name && (
        <div className="mono small muted" style={{ textAlign: 'center', marginTop: 24 }}>
          {user.name}
        </div>
      )}
      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 10 }}
        onClick={() => void signOutUser()}
      >
        {t('settings.signOut')}
      </button>
    </div>
  );
}
