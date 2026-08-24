import { describe, expect, it } from 'vitest';
import { slug, workoutId } from '../ids';

describe('slug', () => {
  it('lowercases, strips accents/punctuation, dashes spaces', () => {
    expect(slug('Panca Piana (Manubrio)')).toBe('panca-piana-manubrio');
    expect(slug('Stacchi 45° — heavy!')).toBe('stacchi-45-heavy');
    expect(slug('  più  forza  ')).toBe('piu-forza');
  });
});

describe('workoutId', () => {
  it('is deterministic and readable', () => {
    const a = workoutId('hevy', '2026-06-20', 'Giorno B (Gennaio) 14:13');
    const b = workoutId('hevy', '2026-06-20', 'Giorno B (Gennaio) 14:13');
    expect(a).toBe(b);
    expect(a).toBe('hevy-2026-06-20-giorno-b-gennaio-14-13');
  });
});
