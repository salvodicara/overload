type RouteLike = { view: string };
export type RouteMotion = 'peer' | 'forward' | 'back';

const TABS = new Set(['home', 'train', 'library', 'progress', 'profile']);

export function routeMotion(from: RouteLike, to: RouteLike): Exclude<RouteMotion, 'back'> {
  return TABS.has(from.view) && TABS.has(to.view) ? 'peer' : 'forward';
}

let motionGeneration = 0;

export function transitionRoute(motion: RouteMotion, update: () => void): void {
  const root = document.documentElement;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    delete root.dataset.routeMotion;
    update();
    return;
  }

  const generation = ++motionGeneration;
  root.dataset.routeMotion = motion;
  const clearMotion = (): void => {
    if (motionGeneration === generation) delete root.dataset.routeMotion;
  };
  update();
  window.setTimeout(clearMotion, 200);
}
