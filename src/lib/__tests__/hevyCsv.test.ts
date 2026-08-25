import { describe, expect, it } from 'vitest';
import { parseHevyCsv } from '../hevyCsv';

const HEADER =
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"';

const FIXTURE = [
  HEADER,
  '"Giorno B (Gennaio)","20 giu 2026, 14:13","20 giu 2026, 15:10","Sessione ok, poco tempo","Panca Piana (Manubrio)","","","0","normal","20.0","10","","",""',
  '"Giorno B (Gennaio)","20 giu 2026, 14:13","20 giu 2026, 15:10","Sessione ok, poco tempo","Panca Piana (Manubrio)","","","1","normal","22.5","8","","",""',
  '"Giorno B (Gennaio)","20 giu 2026, 14:13","20 giu 2026, 15:10","Sessione ok, poco tempo","Lat Machine","","","0","normal","","","","",""',
  '"Giorno B (Gennaio)","20 giu 2026, 14:13","20 giu 2026, 15:10","Sessione ok, poco tempo","Esercizio Sconosciuto","","nota libera","0","normal","30","12","","",""',
  '"Giorno A","21 giu 2026, 09:05","","Nota con ""virgolette"", e virgola","Squat","","","0","normal","60","5","","",""',
  '',
].join('\n');

const ALIASES: Record<string, string> = {
  'Panca Piana (Manubrio)': 'db-bench-press',
  'Lat Machine': 'lat-pulldown',
  Squat: 'squat',
};

describe('parseHevyCsv', () => {
  const { workouts, unknownExercises } = parseHevyCsv(FIXTURE, ALIASES);

  it('groups rows into one workout per (title, start_time)', () => {
    expect(workouts).toHaveLength(2);
  });

  it('builds a deterministic id from source, date and title+time', () => {
    expect(workouts[0].id).toBe('hevy-2026-06-20-giorno-b-gennaio-14-13');
    expect(workouts[1].id).toBe('hevy-2026-06-21-giorno-a-09-05');
  });

  it('parses the italian date and time into date, startTs and endTs', () => {
    expect(workouts[0].date).toBe('2026-06-20');
    expect(workouts[0].startTs).toBe(new Date(2026, 5, 20, 14, 13).getTime());
    expect(workouts[0].endTs).toBe(new Date(2026, 5, 20, 15, 10).getTime());
    expect(workouts[0].updatedAt).toBe(workouts[0].startTs);
    expect(workouts[1].endTs).toBeUndefined();
  });

  it('marks the workout as imported from hevy and labels it with the title', () => {
    expect(workouts[0].source).toBe('hevy');
    expect(workouts[0].dayLabel).toBe('Giorno B (Gennaio)');
  });

  it('skips rows without weight or reps and keeps row order', () => {
    expect(workouts[0].sets).toEqual([
      { exerciseId: 'db-bench-press', weightKg: 20, reps: 10, done: true },
      { exerciseId: 'db-bench-press', weightKg: 22.5, reps: 8, done: true },
      { exerciseId: 'hevy:esercizio-sconosciuto', weightKg: 30, reps: 12, done: true },
    ]);
  });

  it('computes the workout volume from the parsed sets', () => {
    expect(workouts[0].volumeKg).toBe(740);
    expect(workouts[1].volumeKg).toBe(300);
  });

  it('reports unknown exercise titles once, in their original form', () => {
    expect(unknownExercises).toEqual(['Esercizio Sconosciuto']);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(workouts[1].note).toBe('Nota con "virgolette", e virgola');
    expect(workouts[0].note).toBe('Sessione ok, poco tempo');
  });

  it('parses every italian month abbreviation', () => {
    const months = [
      'gen',
      'feb',
      'mar',
      'apr',
      'mag',
      'giu',
      'lug',
      'ago',
      'set',
      'ott',
      'nov',
      'dic',
    ];
    const rows = months.map(
      (m, i) => `"D${i}","5 ${m} 2026, 08:00","","","Squat","","","0","normal","50","5","","",""`,
    );
    const parsed = parseHevyCsv([HEADER, ...rows].join('\n'), ALIASES);
    expect(parsed.workouts.map((w) => w.date)).toEqual(
      months.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}-05`),
    );
  });

  it('handles CRLF line endings and an empty csv', () => {
    const crlf = parseHevyCsv(FIXTURE.split('\n').join('\r\n'), ALIASES);
    expect(crlf.workouts).toHaveLength(2);
    expect(crlf.workouts[0].sets).toHaveLength(3);
    expect(parseHevyCsv('', ALIASES)).toEqual({ workouts: [], unknownExercises: [], notes: [] });
    expect(parseHevyCsv(HEADER, ALIASES)).toEqual({ workouts: [], unknownExercises: [], notes: [] });
  });

  it('reports a repeated unknown exercise only once', () => {
    const repeated = [
      HEADER,
      '"D","1 gen 2026, 08:00","","","Sconosciuto","","","0","normal","10","10","","",""',
      '"D","1 gen 2026, 08:00","","","Sconosciuto","","","1","normal","10","10","","",""',
      '"D","2 gen 2026, 08:00","","","Sconosciuto","","","0","normal","10","10","","",""',
    ].join('\n');
    expect(parseHevyCsv(repeated, ALIASES).unknownExercises).toEqual(['Sconosciuto']);
  });
});

describe('exercise notes extraction', () => {
  it('collects dated notes per exercise and skips repeated text', () => {
    const rows = [
      '"W","1 gen 2026, 10:00","1 gen 2026, 11:00","","Squat (Bilanciere)",,"fermo con 25",0,"normal",30,5,,,',
      '"W","1 gen 2026, 10:00","1 gen 2026, 11:00","","Squat (Bilanciere)",,"fermo con 25",1,"normal",30,5,,,',
      '"W","8 gen 2026, 10:00","8 gen 2026, 11:00","","Squat (Bilanciere)",,"fermo con 25",0,"normal",32.5,5,,,',
      '"W","15 gen 2026, 10:00","15 gen 2026, 11:00","","Squat (Bilanciere)",,"salire a 35",0,"normal",32.5,6,,,',
    ];
    const { notes } = parseHevyCsv([HEADER, ...rows].join('\n'), { 'Squat (Bilanciere)': 'Barbell_Squat' });
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe('Barbell_Squat');
    expect(notes[0].entries).toEqual([
      { date: '2026-01-01', text: 'fermo con 25' },
      { date: '2026-01-15', text: 'salire a 35' },
    ]);
  });
});
