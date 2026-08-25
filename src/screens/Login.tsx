import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithGoogle } from '../lib/firebase';

export function Login() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="screen page login-screen">
      <div className="login-copy">
        <h1 className="display login-wordmark">{t('app.name')}</h1>
        <p className="login-value">{t('login.subtitle')}</p>
      </div>
      <div className="login-actions">
        <button
          className="btn btn-accent btn-block btn-big login-primary"
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
        {error && (
          <div className="banner banner-warn login-error" role="alert">
            {t('login.error')}
          </div>
        )}
        <button
          className="meta muted action-link login-recovery"
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
    </div>
  );
}
