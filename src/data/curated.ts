// Curated overlay for the free-exercise-db catalog: Italian names, Hevy import
// aliases, and per-exercise progression increments. Keyed by free-exercise-db id.

export type Curated = {
  nameIt: string;
  /** Hevy exercise_title strings that map to this exercise on import. */
  aliases?: string[];
  /** Double-progression increment; default 2.5 kg when omitted. */
  incrementKg?: number;
  youtubeId?: string;
};

export const CURATED: Record<string, Curated> = {
  Dumbbell_Bench_Press: { nameIt: 'Panca piana manubri', aliases: ['Panca Piana (Manubrio)'] },
  Incline_Dumbbell_Press: { nameIt: 'Panca inclinata manubri', aliases: ['Panca Inclinata (Manubrio)'] },
  Smith_Machine_Incline_Bench_Press: {
    nameIt: 'Panca inclinata al multipower',
    aliases: ['Panca Inclinata (Multipower)'],
  },
  Smith_Machine_Bench_Press: { nameIt: 'Panca piana al multipower', aliases: ['Panca Piana (Multipower)'] },
  Butterfly: { nameIt: 'Pectoral machine', aliases: ['Farfalla (Pec Deck)', 'Croci (Macchina)'] },
  Cable_Crossover: { nameIt: 'Croci ai cavi alti', aliases: ['Croci ai Cavi'] },
  Low_Cable_Crossover: { nameIt: 'Croci ai cavi bassi', aliases: ['Croci Cavo Basso'] },
  Incline_Dumbbell_Flyes: { nameIt: 'Croci su inclinata', aliases: ['Croci Petto Inclinate (Manubrio)'] },
  Seated_Cable_Rows: {
    nameIt: 'Pulley',
    aliases: [
      'Rematore al Cavo da Seduto',
      'Rematore al Cavo da Seduto - Presa Larga',
      'Rematore al cavo da seduto - Impugnatura a V (cavo)',
    ],
  },
  Dumbbell_Incline_Row: {
    nameIt: 'Rematore manubri su panca',
    aliases: ['Rematore Inclinato con Petto Appoggiato (Manubrio)'],
  },
  Bent_Over_Barbell_Row: { nameIt: 'Rematore bilanciere', aliases: ['Rematore Inclinato (Bilanciere)'] },
  'One-Arm_Dumbbell_Row': { nameIt: 'Rematore manubrio singolo', aliases: ['Rematore Manubrio'] },
  'T-Bar_Row_with_Handle': { nameIt: 'Rematore T-bar', aliases: ['Rematore T Bar'] },
  'Wide-Grip_Lat_Pulldown': { nameIt: 'Lat machine presa prona', aliases: ['Lat Pulldown (Cavo)'] },
  'V-Bar_Pulldown': { nameIt: 'Lat machine presa neutra', aliases: ['Lat Pulldown (Banda)'] },
  Face_Pull: { nameIt: 'Face pull ai cavi' },
  'EZ-Bar_Curl': { nameIt: 'Curl bilanciere EZ', aliases: ['Curl Bicipiti con EZ Bar'] },
  Barbell_Curl: { nameIt: 'Curl bilanciere', aliases: ['Curl Bicipiti (Bilanciere)'] },
  Hammer_Curls: { nameIt: 'Curl a martello', aliases: ['Bicipiti Martello (Manubrio)'] },
  Spider_Curl: { nameIt: 'Spider curl', aliases: ['Curl a ragno (manubri)'] },
  'EZ-Bar_Skullcrusher': {
    nameIt: 'French press',
    aliases: ['Skullcrusher (Bilanciere)', 'Estensione Tricipiti (Bilanciere)'],
  },
  'Triceps_Pushdown_-_Rope_Attachment': {
    nameIt: 'Push down fune',
    aliases: ['Pushdown Tricipiti con Corda'],
  },
  Seated_Side_Lateral_Raise: {
    nameIt: 'Alzate laterali da seduto',
    aliases: ['Aperture Laterali Seduto (Manubrio)'],
  },
  Barbell_Squat: { nameIt: 'Squat con bilanciere', aliases: ['Squat (Bilanciere)'], incrementKg: 5 },
  Leg_Press: {
    nameIt: 'Leg press 45°',
    aliases: ['Leg Press (Macchina)', 'Leg Press Gamba Singola (Macchina)'],
    incrementKg: 5,
  },
  Hack_Squat: { nameIt: 'Hack squat', aliases: ['Hack Squat (Macchina)'], incrementKg: 5 },
  Barbell_Deadlift: { nameIt: 'Stacco da terra', aliases: ['Stacco da Terra (Bilanciere)'], incrementKg: 5 },
  Romanian_Deadlift: {
    nameIt: 'Stacco rumeno',
    aliases: ['Stacco da Terra (Manubrio)'],
    incrementKg: 5,
  },
  Seated_Leg_Curl: { nameIt: 'Leg curl seduto', aliases: ['Leg Curl Seduto (Macchina)'] },
  Leg_Extensions: {
    nameIt: 'Leg extension',
    aliases: ['Leg Extension (Macchina)', 'Leg Extensions Gamba Singola'],
  },
  Dumbbell_Lunges: { nameIt: 'Affondi con manubri', aliases: ['Affondi (Manubrio)'] },
  Calf_Press_On_The_Leg_Press_Machine: {
    nameIt: 'Polpacci alla pressa',
    aliases: ['Calf Press (Macchina)'],
  },
  Standing_Calf_Raises: { nameIt: 'Polpacci in piedi' },
  Hanging_Leg_Raise: { nameIt: 'Leg raise alla sbarra' },
  Plank: { nameIt: 'Plank' },
  Side_Bridge: { nameIt: 'Side plank' },
};
