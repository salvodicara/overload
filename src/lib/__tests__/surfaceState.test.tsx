import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSurfaceState } from '../../hooks/useSurfaceState';

function HomeStateProbe() {
  const [state] = useSurfaceState('home', {
    periodUnit: 'week',
    periodAnchor: '2026-08-26',
    chartMetric: 'volume',
    selectedDay: null,
  });
  return <span>{`${state.periodUnit}|${state.periodAnchor}|${state.chartMetric}`}</span>;
}

describe('useSurfaceState', () => {
  beforeEach(() => {
    vi.stubGlobal('history', {
      state: {
        route: { view: 'home' },
        entryKey: 'old-month',
        surfaces: {
          home: {
            periodUnit: 'month',
            periodAnchor: '2026-05-01',
            chartMetric: 'durationMin',
          },
        },
      },
      replaceState() {},
    });
  });

  it('hydrates an originating surface snapshot over current defaults', () => {
    expect(renderToStaticMarkup(<HomeStateProbe />)).toContain(
      'month|2026-05-01|durationMin',
    );
  });
});
