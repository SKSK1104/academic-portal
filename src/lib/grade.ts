import type { AcademicSummary, PbdSummary } from './types';

export function gradeFromScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return 'TH';
  if (score >= 82) return 'A';
  if (score >= 66) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  if (score >= 20) return 'E';
  return 'F';
}

export function buildAcademicSummary(rows: Array<{ score: number | null; grade: string | null }>): AcademicSummary {
  const grades: AcademicSummary['grades'] = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, TH: 0 };
  let scoreTotal = 0;
  let scored = 0;

  rows.forEach((row) => {
    const grade = (row.grade || gradeFromScore(row.score)) as keyof typeof grades;
    if (grade in grades) grades[grade] += 1;
    if (row.score !== null && Number.isFinite(Number(row.score))) {
      scoreTotal += Number(row.score);
      scored += 1;
    }
  });

  const total = rows.length;
  const absent = grades.TH;
  const attended = total - absent;
  const intervention = grades.F;
  const mtm = grades.A + grades.B + grades.C + grades.D + grades.E;

  return {
    total,
    attended,
    absent,
    intervention,
    interventionPct: attended ? (intervention / attended) * 100 : 0,
    mtm,
    mtmPct: attended ? (mtm / attended) * 100 : 0,
    averageScore: scored ? scoreTotal / scored : null,
    grades
  };
}

export function buildPbdSummary(rows: Array<{ tp: number | null }>): PbdSummary {
  const tps: PbdSummary['tps'] = { TP1: 0, TP2: 0, TP3: 0, TP4: 0, TP5: 0, TP6: 0 };
  rows.forEach(({ tp }) => {
    if (tp && tp >= 1 && tp <= 6) tps[`TP${tp}` as keyof typeof tps] += 1;
  });
  const total = Object.values(tps).reduce((a, b) => a + b, 0);
  const intervention = tps.TP1 + tps.TP2;
  const mtm = total - intervention;
  return {
    total,
    intervention,
    interventionPct: total ? (intervention / total) * 100 : 0,
    mtm,
    mtmPct: total ? (mtm / total) * 100 : 0,
    tps
  };
}
