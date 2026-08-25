import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithGoogle } from '../lib/firebase';

export function Login() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div
      className="screen page"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        paddingBottom: '20dvh',
      }}
    >
      <div>
        <div className="display" style={{ fontSize: 'clamp(56px, 18vw, 96px)' }}>
          Over
          <br />
          load
        </div>
        <div
          className="mono meta"
          style={{ color: 'var(--accent-text)', marginTop: 'var(--space-3)' }}
        >
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
      <button
        className="meta muted action-link"
        style={{ alignSelf: 'center' }}
        onClick={() => {
          void (async () => {
            const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
            await Promise.all(regs.map((r) => r.unregister()));
            await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
            location.reload();
          })();
        }}
      >
        {t('login.reset')}
      </button>
    </div>
  );
}
