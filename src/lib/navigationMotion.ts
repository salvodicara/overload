type RouteLike = { view: string };
export type RouteMotion = 'peer' | 'forward' | 'back';

const TABS = new Set(['home', 'train', 'library', 'progress', 'profile']);

export function routeMotion(from: RouteLike, to: RouteLike): Exclude<RouteMotion, 'back'> {
  return TABS.has(from.view) && TABS.has(to.view) ? 'peer' : 'forward';
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

let motionGeneration = 0;

export function transitionRoute(motion: RouteMotion, update: () => void): void {
  const root = document.documentElement;
  const viewDocument = document as ViewTransitionDocument;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    update();
    return;
  }

  const generation = ++motionGeneration;
  root.dataset.routeMotion = motion;
  const clearMotion = (): void => {
    if (motionGeneration === generation) delete root.dataset.routeMotion;
  };
  if (!viewDocument.startViewTransition) {
    update();
    window.setTimeout(clearMotion, 300);
    return;
  }

  const transition = viewDocument.startViewTransition.call(document, update);
  void transition.ready.catch(() => {});
  void transition.updateCallbackDone.catch(() => {});
  void transition.finished.then(clearMotion, clearMotion);
}
