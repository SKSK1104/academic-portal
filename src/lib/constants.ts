export const SCHOOL_NAME = import.meta.env.VITE_SCHOOL_NAME || 'SK Simpang Kuda';
export const SCHOOL_CODE = import.meta.env.VITE_SCHOOL_CODE || 'YBB1104';

export const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'TH'] as const;
export const TP_ORDER = ['TP1', 'TP2', 'TP3', 'TP4', 'TP5', 'TP6'] as const;

export const SUBJECT_ALIASES: Record<string, string> = {
  BM: 'BM',
  'B.MELAYU': 'BM',
  'BAHASA MELAYU': 'BM',
  BI: 'BI',
  'B.INGGERIS': 'BI',
  ENGLISH: 'BI',
  'BAHASA INGGERIS': 'BI',
  MT: 'MAT',
  MAT: 'MAT',
  MM: 'MAT',
  MATEMATIK: 'MAT',
  SN: 'SN',
  SAINS: 'SN',
  SEJ: 'SEJ',
  SEJARAH: 'SEJ',
  PI: 'PI',
  PAI: 'PI',
  PM: 'PM',
  'PENDIDIKAN ISLAM': 'PI',
  'PENDIDIKAN MORAL': 'PM',
  'PAI/PM': 'PAI_PM',
  'PI/PM': 'PAI_PM',
  BIN: 'BI_IBAN',
  'B.IBAN': 'BI_IBAN',
  'BAHASA IBAN': 'BI_IBAN',
  RBT: 'RBT',
  'REKA BENTUK DAN TEKNOLOGI': 'RBT',
  PSV: 'PSV',
  'SENI VISUAL': 'PSV',
  'PENDIDIKAN SENI VISUAL': 'PSV',
  PMZ: 'MUZIK',
  'P.MUZIK': 'MUZIK',
  'PENDIDIKAN MUZIK': 'MUZIK',
  PJPK: 'PJPK',
  PJK: 'PJPK',
  'PENDIDIKAN JASMANI DAN PENDIDIKAN KESIHATAN': 'PJPK'
};
