// Keeps the screen on during a workout so timers and audio stay alive.
// Auto-released by the OS when the page hides; re-acquired on return.
let lock: WakeLockSentinel | null = null;
let wanted = false;
let bound = false;

async function request(): Promise<void> {
  try {
    lock = await navigator.wakeLock?.request('screen');
  } catch {
    lock = null;
  }
}

export function acquireWakeLock(): void {
  wanted = true;
  void request();
  if (!bound) {
    bound = true;
    document.addEventListener('visibilitychange', () => {
      if (wanted && document.visibilityState === 'visible') void request();
    });
  }
}

export function releaseWakeLock(): void {
  wanted = false;
  void lock?.release().catch(() => undefined);
  lock = null;
}
