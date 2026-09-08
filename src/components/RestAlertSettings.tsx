import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { beep, unlockAudio } from '../lib/audio';

export function RestAlertSettings() {
  const { t } = useTranslation();
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="settings-row settings-row--control">
        <strong>{t('timer.sound')}</strong>
        <button
          className="btn btn-ghost"
          onClick={() => {
            unlockAudio();
            beep();
          }}
        >
          {t('timer.testSound')}
        </button>
      </div>
      <div className="settings-row" style={{ display: 'block' }}>
        <p className="small muted">{t('timer.openAppNotice')}</p>
        <p className="small" role="status">
          {t('timer.permission.' + permission)}
        </p>
        {permission === 'default' && (
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setPermission(await Notification.requestPermission());
              } catch {
                setPermission('unsupported');
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('timer.enableNotifications')}
          </button>
        )}
      </div>
    </>
  );
}
