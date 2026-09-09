export type AssessmentKind = 'AR' | 'UASA' | 'PBD';
export type ImportKind = 'ROSTER_CSV' | 'AR_XLSX' | 'UASA_PDF' | 'PBD_PDF';

export interface Student {
  id: string;
  student_id: string;
  name: string;
  mykid: string;
  dob?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
}

export interface Enrolment {
  id: string;
  school_year: number;
  year_level: number;
  class_name: string;
  class_teacher?: string | null;
  student_id: string;
  students?: Student;
}

export interface Subject {
  id: string;
  code: string;
  name_ms: string;
  name_en?: string | null;
}

export interface Assessment {
  id: string;
  school_year: number;
  kind: AssessmentKind;
  code: string;
  sequence_no?: number | null;
  title?: string | null;
  period_label?: string | null;
  source_kind: 'manual' | 'pdf' | 'xlsx';
  is_active: boolean;
}

export interface AcademicRow {
  enrolment_id: string;
  student_id: string;
  student_name: string;
  subject_id: string;
  subject_code: string;
  tov: number | null;
  etr: number | null;
  score: number | null;
  grade: string | null;
}

export interface DistributionItem {
  key: string;
  count: number;
  pct: number;
}

export interface AcademicSummary {
  total: number;
  attended: number;
  absent: number;
  intervention: number;
  interventionPct: number;
  mtm: number;
  mtmPct: number;
  averageScore: number | null;
  grades: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'TH', number>;
}

export interface PbdSummary {
  total: number;
  intervention: number;
  interventionPct: number;
  mtm: number;
  mtmPct: number;
  tps: Record<'TP1' | 'TP2' | 'TP3' | 'TP4' | 'TP5' | 'TP6', number>;
}

export interface ParsedPdfDocument {
  doc_type: 'PBD_INDIVIDUAL' | 'PBD_SUMMARY' | 'UASA_INDIVIDUAL' | 'UNKNOWN';
  school_name?: string | null;
  school_year?: number | null;
  year_level?: number | null;
  class_name?: string | null;
  activity?: string | null;
  class_teacher?: string | null;
  subjects?: Array<{ label: string; code_hint?: string | null }>;
  rows?: Array<{
    student_name: string;
    mykid?: string | null;
    gender?: string | null;
    values: Record<string, string | number | null>;
  }>;
  summary?: Array<{
    subject_label: string;
    TP1?: number;
    TP2?: number;
    TP3?: number;
    TP4?: number;
    TP5?: number;
    TP6?: number;
    total?: number;
  }>;
  warnings?: string[];
}
