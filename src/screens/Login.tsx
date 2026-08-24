import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithGoogle } from '../lib/firebase';

export function Login() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div
      className="screen"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 18,
        paddingBottom: '20dvh',
      }}
    >
      <div>
        <div className="display" style={{ fontSize: 'clamp(56px, 18vw, 96px)' }}>
          Over
          <br />
          load
        </div>
        <div className="mono small" style={{ color: 'var(--accent-text)', marginTop: 10 }}>
          {t('app.tagline')}
        </div>
      </div>
      <p className="muted" style={{ maxWidth: '46ch' }}>
        {t('login.subtitle')}
      </p>
      <button
        className="btn btn-accent btn-block btn-big"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(false);
          signInWithGoogle()
            .catch(() => setError(true))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? t('login.loading') : t('login.google')}
      </button>
      {error && <div className="banner banner-warn">{t('login.error')}</div>}
    </div>
  );
}
