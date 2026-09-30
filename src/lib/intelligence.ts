// Kecerdasan Pelbagai: shared constants and pure helpers.
// Nothing in this file talks to the database.

export const MI_CODES = ['VL', 'LM', 'INTRA', 'VR', 'NT', 'INTER', 'KN', 'MZ', 'EK'] as const;
export type MiCode = typeof MI_CODES[number];

export const MI_LABELS: Record<MiCode, string> = {
  VL: 'Verbal Linguistik',
  LM: 'Logik Matematik',
  INTRA: 'Intrapersonal',
  VR: 'Visual Ruang',
  NT: 'Naturalis',
  INTER: 'Interpersonal',
  KN: 'Kinestatik',
  MZ: 'Muzik',
  EK: 'Eksistensial'
};

export const MI_COLORS: Record<MiCode, string> = {
  VL: '#5bc0ff',
  LM: '#7c8cff',
  INTRA: '#b388ff',
  VR: '#ff8fc7',
  NT: '#4fd6a0',
  INTER: '#ffc44d',
  KN: '#ff8a5c',
  MZ: '#56e0e0',
  EK: '#c9d86b'
};

export type PsyFormat = 'T4_APTITUD' | 'T5_IKEP' | 'T6_APTITUD';

export const FORMAT_LABELS: Record<PsyFormat, string> = {
  T4_APTITUD: 'Ujian Aptitud Tahun 4',
  T5_IKEP: 'IKEP Tahun 5',
  T6_APTITUD: 'Ujian Aptitud Tahun 6'
};

export interface AptitudeSkill {
  key: string;
  label: string;
  section: 'BM' | 'BI' | 'LM';
  score: number;
  max: number;
  threshold: number;
  baik: boolean;
}

export interface PsyProfile {
  format: PsyFormat;
  name: string;
  mykid: string;
  class_name: string;
  year_level: number;
  school_year: number;
  source_file: string;
  scores?: Partial<Record<MiCode, number>>;
  dominant?: MiCode[];
  bahagian_b?: { menaakul: number | null; masalah: number | null };
  aptitude?: AptitudeSkill[];
}

export type MiLevel = 'TINGGI' | 'SEDERHANA' | 'RENDAH';

// Bands printed on the official report for each format.
export function miLevel(format: PsyFormat, pct: number): MiLevel {
  if (format === 'T6_APTITUD') return pct >= 80 ? 'TINGGI' : pct >= 50 ? 'SEDERHANA' : 'RENDAH';
  return pct >= 75 ? 'TINGGI' : pct >= 50 ? 'SEDERHANA' : 'RENDAH';
}

// All intelligences tied for the highest score.
export function dominantOf(scores: Partial<Record<MiCode, number>>): MiCode[] {
  const entries = MI_CODES.filter((c) => typeof scores[c] === 'number').map((c) => [c, scores[c] as number] as const);
  if (!entries.length) return [];
  const top = Math.max(...entries.map(([, v]) => v));
  return entries.filter(([, v]) => v === top).map(([c]) => c);
}

export function isMiProfile(p: PsyProfile | null | undefined): boolean {
  return !!p && (p.format === 'T5_IKEP' || p.format === 'T6_APTITUD') && !!p.dominant?.length;
}
