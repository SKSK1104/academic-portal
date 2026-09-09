import { supabase } from './supabase';
import type { Assessment, Subject } from './types';

export async function getAvailableYears(): Promise<number[]> {
  const { data, error } = await supabase.from('v2_enrolments').select('school_year');
  if (error) throw error;
  const years = [...new Set((data || []).map((x) => Number(x.school_year)).filter(Boolean))].sort((a, b) => b - a);
  return years.length ? years : [new Date().getFullYear()];
}

export async function getClasses(schoolYear: number): Promise<Array<{ className: string; yearLevel: number }>> {
  const { data, error } = await supabase.from('v2_enrolments').select('class_name,year_level').eq('school_year', schoolYear);
  if (error) throw error;
  const map = new Map<string, number>();
  (data || []).forEach((row) => map.set(row.class_name, Number(row.year_level)));
  return [...map.entries()].map(([className, yearLevel]) => ({ className, yearLevel })).sort((a, b) => a.yearLevel - b.yearLevel || a.className.localeCompare(b.className));
}

export async function getAssessments(schoolYear: number, kind?: 'AR' | 'UASA' | 'PBD'): Promise<Assessment[]> {
  let q = supabase.from('v2_assessments').select('*').eq('school_year', schoolYear).eq('is_active', true).order('kind').order('sequence_no', { ascending: true });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Assessment[];
}

export async function getSubjectsForYear(yearLevel: number, mode: 'AR' | 'UASA' | 'PBD'): Promise<Subject[]> {
  const flag = mode === 'AR' ? 'ar_enabled' : mode === 'UASA' ? 'uasa_enabled' : 'pbd_enabled';
  const { data, error } = await supabase
    .from('v2_subject_offerings')
    .select('subjects:v2_subjects!v2_subject_offerings_subject_id_fkey(id,code,name_ms,name_en)')
    .eq('year_level', yearLevel)
    .eq(flag, true);
  if (error) throw error;
  return (data || []).map((x: any) => x.subjects).filter(Boolean).sort((a: Subject, b: Subject) => a.name_ms.localeCompare(b.name_ms));
}

export async function createNextAr(schoolYear: number): Promise<Assessment> {
  const existing = await getAssessments(schoolYear, 'AR');
  const max = Math.max(0, ...existing.map((x) => Number(x.sequence_no || Number(String(x.code).replace(/\D/g, '')) || 0)));
  const next = max + 1;
  const { data, error } = await supabase.from('v2_assessments').insert({
    school_year: schoolYear,
    kind: 'AR',
    code: `AR${next}`,
    sequence_no: next,
    title: `Assessment Round ${next}`,
    source_kind: 'manual',
    is_active: true
  }).select('*').single();
  if (error) throw error;
  return data as Assessment;
}
