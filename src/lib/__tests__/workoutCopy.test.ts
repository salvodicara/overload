import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import itCopy from '../../i18n/it.json';

describe.each([
  ['en', en],
  ['it', itCopy],
] as const)('%s workout copy bundle', (_locale, copy) => {
  it('omits retired phase, program-start, personal-note, and Momentum copy', () => {
    expect(copy).not.toHaveProperty('phase');
    expect(copy.suggest).not.toHaveProperty('phase1');
    expect(copy.suggest).not.toHaveProperty('deload');
    expect(copy.home).not.toHaveProperty('setStartTitle');
    expect(copy.home).not.toHaveProperty('setStartBody');
    expect(copy.home).not.toHaveProperty('startToday');
    expect(copy.notes).not.toHaveProperty('placeholder');
    expect(copy).not.toHaveProperty('momentum');
  });
});
