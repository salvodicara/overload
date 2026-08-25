// Curated overlay for the free-exercise-db catalog: Hevy import aliases and
// demonstration videos. Keyed by free-exercise-db id.

export type Curated = {
  /** Hevy exercise_title strings that map to this exercise on import. */
  aliases?: string[];
  youtubeId?: string;
};

export const CURATED: Record<string, Curated> = {
  Dumbbell_Bench_Press: {
    youtubeId: 'Y_7aHqXeCfQ',
    aliases: ['Panca Piana (Manubrio)'],
  },
  Incline_Dumbbell_Press: {
    aliases: ['Panca Inclinata (Manubrio)'],
  },
  Smith_Machine_Incline_Bench_Press: {
    youtubeId: 'b8DqTO6ak0k',
    aliases: ['Panca Inclinata (Multipower)'],
  },
  Smith_Machine_Bench_Press: {
    aliases: ['Panca Piana (Multipower)'],
  },
  Butterfly: {
    youtubeId: 'Dbly77Jgbo8',
    aliases: ['Farfalla (Pec Deck)', 'Croci (Macchina)'],
  },
  Cable_Crossover: {
    youtubeId: '8Um35Es-ROE',
    aliases: ['Croci ai Cavi'],
  },
  Low_Cable_Crossover: { aliases: ['Croci Cavo Basso'] },
  Incline_Dumbbell_Flyes: {
    aliases: ['Croci Petto Inclinate (Manubrio)'],
  },
  Seated_Cable_Rows: {
    youtubeId: 'GZbfZ033f74',
    aliases: [
      'Rematore al Cavo da Seduto',
      'Rematore al Cavo da Seduto - Presa Larga',
      'Rematore al cavo da seduto - Impugnatura a V (cavo)',
    ],
  },
  Dumbbell_Incline_Row: {
    youtubeId: 'r9ggHLL1tgs',
    aliases: ['Rematore Inclinato con Petto Appoggiato (Manubrio)'],
  },
  Bent_Over_Barbell_Row: {
    aliases: ['Rematore Inclinato (Bilanciere)'],
  },
  'One-Arm_Dumbbell_Row': { aliases: ['Rematore Manubrio'] },
  'T-Bar_Row_with_Handle': {
    youtubeId: '5foJiIVhs8Q',
    aliases: ['Rematore T Bar'],
  },
  'Wide-Grip_Lat_Pulldown': {
    youtubeId: 'O94yEoGXtBY',
    aliases: ['Lat Pulldown (Cavo)'],
  },
  'V-Bar_Pulldown': {
    youtubeId: 'kVB6SlEyjQM',
    aliases: ['Lat Pulldown (Banda)'],
  },
  Face_Pull: { youtubeId: 'eIq5CB9JfKE' },
  'EZ-Bar_Curl': {
    youtubeId: '6LrOTcr595A',
    aliases: ['Curl Bicipiti con EZ Bar'],
  },
  Barbell_Curl: { aliases: ['Curl Bicipiti (Bilanciere)'] },
  Hammer_Curls: { aliases: ['Bicipiti Martello (Manubrio)'] },
  Spider_Curl: {
    youtubeId: 'BsE9zhhTU1A',
    aliases: ['Curl a ragno (manubri)'],
  },
  'EZ-Bar_Skullcrusher': {
    youtubeId: 'QXzhjRnYRT0',
    aliases: ['Skullcrusher (Bilanciere)', 'Estensione Tricipiti (Bilanciere)'],
  },
  'Triceps_Pushdown_-_Rope_Attachment': {
    youtubeId: 'mRmIthbCSNI',
    aliases: ['Pushdown Tricipiti con Corda'],
  },
  Seated_Side_Lateral_Raise: {
    youtubeId: 'n5dsI9qQXwY',
    aliases: ['Aperture Laterali Seduto (Manubrio)'],
  },
  Barbell_Squat: {
    youtubeId: 'bEv6CCg2BC8',
    aliases: ['Squat (Bilanciere)'],
  },
  Leg_Press: {
    youtubeId: 'cDGOn-yfKJA',
    aliases: ['Leg Press (Macchina)', 'Leg Press Gamba Singola (Macchina)'],
  },
  Hack_Squat: {
    youtubeId: 'fE5BWPy7uRc',
    aliases: ['Hack Squat (Macchina)'],
  },
  Barbell_Deadlift: {
    aliases: ['Stacco da Terra (Bilanciere)'],
  },
  Romanian_Deadlift: {
    youtubeId: 'KecWzqYscYc',
    aliases: ['Stacco da Terra (Manubrio)'],
  },
  Seated_Leg_Curl: {
    youtubeId: '_2Kd0d-JEUM',
    aliases: ['Leg Curl Seduto (Macchina)'],
  },
  Leg_Extensions: {
    youtubeId: 'tTbJBUKnWU8',
    aliases: ['Leg Extension (Macchina)', 'Leg Extensions Gamba Singola'],
  },
  Dumbbell_Lunges: {
    youtubeId: '_DLIS8SySzs',
    aliases: ['Affondi (Manubrio)'],
  },
  Calf_Press_On_The_Leg_Press_Machine: {
    youtubeId: '8k435cj30gc',
    aliases: ['Calf Press (Macchina)'],
  },
  'Seated_One-arm_Cable_Pulley_Rows': {
    aliases: ['Rematore al Cavo Singolo'],
  },
  One_Arm_Lat_Pulldown: {
    aliases: ['Lat Pulldown Braccio Singolo'],
  },
  Standing_Biceps_Cable_Curl: {
    aliases: ['Curl Bicipiti (Cavo)'],
  },
  Machine_Triceps_Extension: {
    aliases: ['Estensione Tricipiti (Macchina)'],
  },
  Hanging_Leg_Raise: { youtubeId: 'fLbZrF6MZuE' },
  Plank: { youtubeId: 'mwlp75MS6Rg' },
  Side_Bridge: { youtubeId: '44ND4bOB-T0' },
};
