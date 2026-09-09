import { SUBJECT_ALIASES } from './constants';

export function normalizeSubjectLabel(label: string): string {
  return label.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function subjectCodeFromLabel(label: string): string | null {
  const clean = normalizeSubjectLabel(label);
  return SUBJECT_ALIASES[clean] || null;
}

export function religiousSubjectForStudent(religion?: string | null): 'PI' | 'PM' {
  const value = (religion || '').trim().toUpperCase();
  return value.includes('ISLAM') ? 'PI' : 'PM';
}
