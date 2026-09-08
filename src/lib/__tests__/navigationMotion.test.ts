import { describe, expect, it } from 'vitest';
import { routeMotion } from '../navigationMotion';

describe('routeMotion', () => {
  it('uses peer motion between bottom navigation destinations', () => {
    expect(routeMotion({ view: 'home' }, { view: 'profile' })).toBe('peer');
    expect(routeMotion({ view: 'profile' }, { view: 'train' })).toBe('peer');
  });

  it('uses forward motion when opening detail and editor destinations', () => {
    expect(routeMotion({ view: 'profile' }, { view: 'progress' })).toBe('forward');
    expect(routeMotion({ view: 'profile' }, { view: 'library' })).toBe('forward');
    expect(routeMotion({ view: 'home' }, { view: 'workoutDetail' })).toBe('forward');
    expect(routeMotion({ view: 'library' }, { view: 'exercise' })).toBe('forward');
    expect(routeMotion({ view: 'train' }, { view: 'routineEditor' })).toBe('forward');
  });
});
