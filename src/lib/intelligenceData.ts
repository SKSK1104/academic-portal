// Kecerdasan Pelbagai data access.
// SAFETY: this module only WRITES to v2_intelligence_profiles.
// It never inserts, updates or deletes marks, PBD records, students or enrolments.
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { supabase } from './supabase';
import type { PsyProfile } from './intelligence';
import { parsePsychometricPages, type PsyParseResult, type TextItem } from './importers/psychometricParser';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export async function parsePsychometricPdf(file: File): Promise<PsyParseResult> {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Fail mestilah PDF.');
  const doc = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: TextItem[][] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push((content.items as any[])
      .filter((i) => typeof i.str === 'string' && i.str.trim())
      .map((i) => ({ str: i.str, x: Number(i.transform[4]), y: Number(i.transform[5]) })));
  }
  return parsePsychometricPages(pages, file.name);
}

export interface MatchResult {
  matched: Array<{ profile: PsyProfile; enrolmentId: string; rosterClass: string }>;
  unmatched: PsyProfile[];
  classMismatch: string[];
}

// Match by MyKid only (never by name) against that year level's roster.
export async function matchToRoster(profiles: PsyProfile[], schoolYear: number): Promise<MatchResult> {
  const levels = [...new Set(profiles.map((p) => p.year_level).filter(Boolean))];
  const { data, error } = await supabase
    .from('v2_enrolments')
    .select('id,class_name,year_level,students:v2_students!v2_enrolments_student_id_fkey(mykid)')
    .eq('school_year', schoolYear)
    .in('year_level', levels.length ? levels : [0]);
  if (error) throw error;

  const byMykid = new Map<string, { id: string; class_name: string }>();
  (data || []).forEach((e: any) => {
    const mykid = String(e.students?.mykid || '').replace(/\D/g, '');
    if (mykid) byMykid.set(mykid, { id: e.id, class_name: e.class_name });
  });

  const result: MatchResult = { matched: [], unmatched: [], classMismatch: [] };
  for (const profile of profiles) {
    const hit = byMykid.get(profile.mykid);
    if (!hit) { result.unmatched.push(profile); continue; }
    result.matched.push({ profile, enrolmentId: hit.id, rosterClass: hit.class_name });
    if (hit.class_name && profile.class_name && !hit.class_name.toUpperCase().includes(profile.class_name)) {
      result.classMismatch.push(`${profile.name}: PDF ${profile.class_name}, roster ${hit.class_name}`);
    }
  }
  return result;
}

export async function saveProfiles(matched: MatchResult['matched'], schoolYear: number): Promise<number> {
  if (!matched.length) return 0;
  const now = new Date().toISOString();
  const rows = matched.map(({ profile, enrolmentId, rosterClass }) => ({
    enrolment_id: enrolmentId,
    school_year: schoolYear,
    profile: { ...profile, class_name: rosterClass || profile.class_name },
    updated_at: now
  }));
  const { error } = await supabase.from('v2_intelligence_profiles').upsert(rows, { onConflict: 'enrolment_id,school_year' });
  if (error) throw error;
  return rows.length;
}

export interface StoredProfile { enrolment_id: string; profile: PsyProfile }

export async function loadProfiles(schoolYear: number): Promise<StoredProfile[]> {
  const out: StoredProfile[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('v2_intelligence_profiles')
      .select('enrolment_id,profile')
      .eq('school_year', schoolYear)
      .order('enrolment_id')
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data || []) as StoredProfile[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function loadProfileYears(): Promise<number[]> {
  const { data, error } = await supabase.from('v2_intelligence_profiles').select('school_year').limit(1000);
  if (error) throw error;
  return [...new Set((data || []).map((r: any) => Number(r.school_year)))].sort((a, b) => b - a);
}

// Read-only lookup used by the AR / PBD analysis pages. Never throws:
// if anything goes wrong the analysis pages simply show no tag.
export async function loadDominantTags(enrolmentIds: string[]): Promise<Map<string, PsyProfile>> {
  const map = new Map<string, PsyProfile>();
  if (!enrolmentIds.length) return map;
  try {
    for (let i = 0; i < enrolmentIds.length; i += 150) {
      const { data, error } = await supabase
        .from('v2_intelligence_profiles')
        .select('enrolment_id,profile')
        .in('enrolment_id', enrolmentIds.slice(i, i + 150));
      if (error) return map;
      (data || []).forEach((r: any) => map.set(r.enrolment_id, r.profile));
    }
  } catch { /* tags are optional */ }
  return map;
}
