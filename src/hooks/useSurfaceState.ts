import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import {
  replaceSurfaceState,
  surfaceStateFor,
  type SurfaceStateMap,
  type SurfaceView,
} from '../lib/navigationState';

export function useSurfaceState<K extends SurfaceView>(
  view: K,
  defaults: SurfaceStateMap[K],
): [SurfaceStateMap[K], Dispatch<SetStateAction<SurfaceStateMap[K]>>] {
  const [state, setState] = useState<SurfaceStateMap[K]>(() => ({
    ...defaults,
    ...surfaceStateFor(view),
  }));

  const update = useCallback<Dispatch<SetStateAction<SurfaceStateMap[K]>>>(
    (next) => {
      setState((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        replaceSurfaceState(view, resolved);
        return resolved;
      });
    },
    [view],
  );

  return [state, update];
}
