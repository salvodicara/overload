// Rest-timer beep. Short Web Audio tones request transient audio focus on
// Android, so they duck over background music (Hevy-like) instead of pausing it.
let ctx: AudioContext | null = null;
export const REST_NOTIFICATION_TAG = 'overload-rest-over';

export async function closeRestNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.ready;
    const notifications = await registration?.getNotifications({ tag: REST_NOTIFICATION_TAG });
    notifications?.forEach((notification) => notification.close());
  } catch {
    /* best effort */
  }
}

/** Call from a user gesture (workout start) to satisfy autoplay policy. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    [0, 0.22, 0.44].forEach((dt) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.type = 'sine';
      osc.frequency.value = 1100;
      gain.gain.setValueAtTime(0.001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.18);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.2);
    });
  } catch {
    /* audio unavailable: vibration still fires */
  }
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
}

/** Locked-screen fallback: local notification with sound/vibration via SW. */
export async function notifyRestOver(title: string, body: string): Promise<void> {
  try {
    if (Notification.permission !== 'granted') return;
    await closeRestNotifications();
    const reg = await navigator.serviceWorker?.ready;
    await reg?.showNotification(title, {
      body,
      tag: REST_NOTIFICATION_TAG,
      requireInteraction: false,
      data: { expiresAt: Date.now() + 15_000 },
    });
    setTimeout(() => void closeRestNotifications(), 15_000);
  } catch {
    /* best effort */
  }
}

export function requestNotifyPermission(): void {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    /* unsupported */
  }
}
