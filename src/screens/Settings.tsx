import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { version } from '../../package.json';
import { ExportRows } from '../components/ExportRows';
import { IconBack, IconForward } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { signOutUser } from '../lib/firebase';
import { useStore } from '../state/useStore';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="settings-section" aria-labelledby={id}>
      <h2 className="settings-section__title" id={id}>
        {title}
      </h2>
      <div className="card settings-group">{children}</div>
    </section>
  );
}

export function Settings() {
  const { t, i18n } = useTranslation();
  const { syncState, settings } = useStore();
  const nav = useStore((state) => state.nav);
  const updateSettings = useStore((state) => state.updateSettings);
  const locale = settings.locale ?? (i18n.language.startsWith('it') ? 'it' : 'en');
  const unit = settings.unit ?? 'kg';

  return (
    <div className="screen">
      <PageHeader
        title={t('settings.title')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />

      <Section id="profile-preferences" title={t('settings.title')}>
        <div className="settings-row settings-row--control">
          <strong id="profile-language-label">{t('settings.language')}</strong>
          <div
            className="seg settings-segment"
            role="group"
            aria-labelledby="profile-language-label"
          >
            {(['it', 'en'] as const).map((language) => (
              <button
                key={language}
                className={`seg-btn ${locale === language ? 'on' : ''}`}
                aria-pressed={locale === language}
                onClick={() => void updateSettings({ locale: language })}
              >
                {t(`settings.${language}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row settings-row--control">
          <strong>{t('settings.unit')}</strong>
          <div className="seg settings-segment" role="group" aria-label={t('settings.unit')}>
            {(['kg', 'lb'] as const).map((weightUnit) => (
              <button
                key={weightUnit}
                className={`seg-btn ${unit === weightUnit ? 'on' : ''}`}
                aria-pressed={unit === weightUnit}
                onClick={() => void updateSettings({ unit: weightUnit })}
              >
                {t(`settings.${weightUnit}`)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section id="profile-data" title={t('settings.data')}>
        <ExportRows />
        <button
          className="settings-row settings-action"
          onClick={() => nav({ view: 'importExport' })}
        >
          <strong className="settings-row__copy">{t('settings.import')}</strong>
          <IconForward aria-hidden="true" />
        </button>
        <div className="settings-row">
          <span>{t('settings.syncLabel')}</span>
          <strong className="settings-row__value" role="status">
            {t(`settings.sync.${syncState}`)}
          </strong>
        </div>
      </Section>

      <Section id="profile-about" title={t('settings.about')}>
        <div className="settings-row settings-about">
          <div className="settings-row__copy">
            <strong>{t('app.name')}</strong>
            <p className="small muted">{t('app.tagline')}</p>
          </div>
          <span className="mono small muted">{t('settings.version', { v: version })}</span>
        </div>
        <p className="settings-attribution small muted">{t('settings.attribution')}</p>
      </Section>

      <button
        className="btn btn-danger btn-block profile-sign-out"
        onClick={() => void signOutUser()}
      >
        {t('settings.signOut')}
      </button>
    </div>
  );
}
