import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeRestNotifications, notifyRestOver, REST_NOTIFICATION_TAG } from '../audio';

describe('rest notification lifecycle', () => {
  const close = vi.fn();
  const getNotifications = vi.fn(async () => [{ close }]);
  const showNotification = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ getNotifications, showNotification }) },
    });
  });

  it('closes tagged notifications explicitly', async () => {
    await closeRestNotifications();
    expect(getNotifications).toHaveBeenCalledWith({ tag: REST_NOTIFICATION_TAG });
    expect(close).toHaveBeenCalled();
  });

  it('replaces an old notification with a non-persistent one', async () => {
    await notifyRestOver('Rest', 'Squat');
    expect(close).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith(
      'Rest',
      expect.objectContaining({ tag: REST_NOTIFICATION_TAG, requireInteraction: false }),
    );
  });
});
