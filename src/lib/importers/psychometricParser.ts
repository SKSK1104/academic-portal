// Pure parser for the psychometric report PDFs (Tahun 4 / 5 / 6).
// Input is the positioned text of each page; no browser or database code here,
// so it can be tested on its own.
import { MI_CODES, dominantOf, type AptitudeSkill, type MiCode, type PsyFormat, type PsyProfile } from '../intelligence';

export interface TextItem { str: string; x: number; y: number }

export interface PsyParseResult {
  format: PsyFormat | null;
  profiles: PsyProfile[];
  errors: string[];
}

const T4_SKILLS: Array<{ key: string; label: string; section: 'BM' | 'BI' | 'LM' }> = [
  { key: 'BM_PERKATAAN', label: 'Kemahiran Perkataan', section: 'BM' },
  { key: 'BM_KONSEP', label: 'Kemahiran Konsep Verbal', section: 'BM' },
  { key: 'BM_KRITIKAL', label: 'Kemahiran Aplikasi Kritikal', section: 'BM' },
  { key: 'BI_WORD', label: 'Word Skills', section: 'BI' },
  { key: 'BI_CONCEPT', label: 'Verbal Concept Skills', section: 'BI' },
  { key: 'BI_CRITICAL', label: 'Critical Application Skills', section: 'BI' },
  { key: 'LM_NUMERIK', label: 'Sistem Numerik & Logik Nombor', section: 'LM' },
  { key: 'LM_PERSEPSI', label: 'Membuat Persepsi', section: 'LM' },
  { key: 'LM_MASALAH', label: 'Penyelesaian Masalah', section: 'LM' }
];

const T6_LABELS: Array<[RegExp, MiCode]> = [
  [/^VERBAL LINGUISTIK$/, 'VL'],
  [/^LOGIK MATEMATIK$/, 'LM'],
  [/^INTRAPERSONAL$/, 'INTRA'],
  [/^VISUAL RUANG$/, 'VR'],
  [/^NATURALIS$/, 'NT'],
  [/^INTERPERSONAL$/, 'INTER'],
  [/^KINESTH?ETIK$|^KINESTATIK$/, 'KN'],
  [/^MUZIK$/, 'MZ'],
  [/^EKSISTEN[ST]IAL$/, 'EK']
];

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const up = (s: string) => clean(s).toUpperCase();
const isInt = (s: string) => /^\d{1,3}$/.test(clean(s));
const sameRow = (a: number, b: number, tol = 3) => Math.abs(a - b) <= tol;

function pageText(items: TextItem[]) {
  return up(items.map((i) => i.str).join(' '));
}

function detectFormat(text: string): PsyFormat | null {
  if (text.includes('IKEP')) return 'T5_IKEP';
  if (text.includes('BAHAGIAN A') && text.includes('KONSTRUK')) return 'T6_APTITUD';
  if (text.includes('KEMAHIRAN PERKATAAN') && text.includes('MARKAH PENUH')) return 'T4_APTITUD';
  return null;
}

// "NAMA MURID : X" may arrive as one item or split into ":" and value.
function fieldValue(items: TextItem[], label: string): string {
  const head = items.find((i) => up(i.str) === label || up(i.str).startsWith(label + ' :'));
  if (!head) return '';
  const inline = up(head.str).slice(label.length).replace(/^\s*:\s*/, '');
  if (inline) return inline;
  return clean(items
    .filter((i) => i !== head && sameRow(i.y, head.y) && i.x > head.x)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join(' ')
    .replace(/^\s*:\s*/, '')).toUpperCase();
}

function schoolYearOf(items: TextItem[]): number {
  for (const i of items) {
    const m = up(i.str).match(/^TAHUN (20\d{2})$/);
    if (m) return Number(m[1]);
  }
  return 0;
}

function classInfo(raw: string) {
  const m = raw.match(/^TAHUN\s*([1-6])\s+(.+)$/);
  if (m) return { yearLevel: Number(m[1]), className: m[2].replace(/BESTARI/g, 'BISTARI').trim() };
  return { yearLevel: 0, className: raw.replace(/BESTARI/g, 'BISTARI').trim() };
}

function parseT5(items: TextItem[]): Partial<Record<MiCode, number>> | string {
  const header = items.find((i) => up(i.str) === 'TARIKH');
  if (!header) return 'Baris tajuk IKEP tidak ditemui';
  const codes = items
    .filter((i) => i !== header && sameRow(i.y, header.y) && (MI_CODES as readonly string[]).includes(up(i.str)))
    .map((i) => ({ code: up(i.str) as MiCode, x: i.x }));
  if (codes.length !== 9) return `Dijangka 9 kod kecerdasan, ditemui ${codes.length}`;
  const values = items.filter((i) => isInt(i.str) && i.y < header.y - 4 && i.y > header.y - 35);
  const scores: Partial<Record<MiCode, number>> = {};
  for (const v of values) {
    const nearest = codes.reduce((best, c) => Math.abs(c.x - v.x) < Math.abs(best.x - v.x) ? c : best);
    if (Math.abs(nearest.x - v.x) > 25) continue;
    scores[nearest.code] = Number(v.str);
  }
  if (Object.keys(scores).length !== 9) return `Dijangka 9 skor, ditemui ${Object.keys(scores).length}`;
  return scores;
}

function valueOnRow(items: TextItem[], label: TextItem): number | null {
  const v = items.find((i) => i !== label && isInt(i.str) && sameRow(i.y, label.y) && i.x > label.x + 100);
  return v ? Number(v.str) : null;
}

function parseT6(items: TextItem[]) {
  const scores: Partial<Record<MiCode, number>> = {};
  for (const item of items) {
    const text = up(item.str);
    const hit = T6_LABELS.find(([re]) => re.test(text));
    if (!hit) continue;
    const v = valueOnRow(items, item);
    if (v !== null) scores[hit[1]] = v;
  }
  if (Object.keys(scores).length !== 9) return `Dijangka 9 skor Bahagian A, ditemui ${Object.keys(scores).length}`;
  const menaakulLabel = items.find((i) => up(i.str) === 'KEMAHIRAN MENAAKUL');
  const masalahLabel = items.find((i) => up(i.str) === 'KEMAHIRAN MENYELESAIKAN MASALAH');
  return {
    scores,
    bahagian_b: {
      menaakul: menaakulLabel ? valueOnRow(items, menaakulLabel) : null,
      masalah: masalahLabel ? valueOnRow(items, masalahLabel) : null
    }
  };
}

function parseT4(items: TextItem[]): AptitudeSkill[] | string {
  const skorHead = items.find((i) => up(i.str) === 'SKOR');
  const maxHead = items.find((i) => up(i.str) === 'MARKAH PENUH');
  const intHead = items.find((i) => up(i.str) === 'INTERPRETASI');
  if (!skorHead || !maxHead || !intHead) return 'Tajuk jadual aptitud tidak ditemui';
  const below = (i: TextItem) => i.y < skorHead.y - 4;
  const byRow = (a: TextItem, b: TextItem) => b.y - a.y;
  const scores = items.filter((i) => below(i) && isInt(i.str) && i.x > skorHead.x - 25 && i.x < maxHead.x - 5).sort(byRow);
  const maxes = items.filter((i) => below(i) && isInt(i.str) && i.x >= maxHead.x - 5 && i.x < intHead.x - 5).sort(byRow);
  const thresholds = items.filter((i) => below(i) && />=\s*\d+/.test(i.str)).sort(byRow);
  if (scores.length !== 9 || maxes.length !== 9 || thresholds.length !== 9) {
    return `Dijangka 9 baris kemahiran, ditemui ${scores.length}/${maxes.length}/${thresholds.length}`;
  }
  return T4_SKILLS.map((s, idx) => {
    const score = Number(scores[idx].str);
    const threshold = Number(thresholds[idx].str.match(/>=\s*(\d+)/)![1]);
    return { ...s, score, max: Number(maxes[idx].str), threshold, baik: score >= threshold };
  });
}

export function parsePsychometricPages(pages: TextItem[][], sourceFile: string): PsyParseResult {
  const profiles: PsyProfile[] = [];
  const errors: string[] = [];
  let format: PsyFormat | null = null;

  pages.forEach((items, index) => {
    const text = pageText(items);
    if (!text.includes('NAMA MURID')) return; // explanation pages
    const pageFormat = detectFormat(text);
    const name = fieldValue(items, 'NAMA MURID');
    const where = `Halaman ${index + 1}${name ? ` (${name})` : ''}`;
    if (!pageFormat) { errors.push(`${where}: format tidak dikenal pasti`); return; }
    if (format && pageFormat !== format) { errors.push(`${where}: format berbeza dalam fail yang sama`); return; }
    format = pageFormat;

    const mykid = fieldValue(items, 'NO. PENGENALAN DIRI').replace(/\D/g, '');
    const { yearLevel, className } = classInfo(fieldValue(items, 'NAMA KELAS'));
    if (!name || mykid.length !== 12) { errors.push(`${where}: nama atau MyKid tidak lengkap`); return; }

    const base: PsyProfile = {
      format: pageFormat, name, mykid, class_name: className, year_level: yearLevel,
      school_year: schoolYearOf(items), source_file: sourceFile
    };

    if (pageFormat === 'T5_IKEP') {
      const scores = parseT5(items);
      if (typeof scores === 'string') { errors.push(`${where}: ${scores}`); return; }
      profiles.push({ ...base, scores, dominant: dominantOf(scores) });
    } else if (pageFormat === 'T6_APTITUD') {
      const r = parseT6(items);
      if (typeof r === 'string') { errors.push(`${where}: ${r}`); return; }
      profiles.push({ ...base, scores: r.scores, bahagian_b: r.bahagian_b, dominant: dominantOf(r.scores) });
    } else {
      const aptitude = parseT4(items);
      if (typeof aptitude === 'string') { errors.push(`${where}: ${aptitude}`); return; }
      profiles.push({ ...base, aptitude });
    }
  });

  const seen = new Set<string>();
  for (const p of profiles) {
    if (seen.has(p.mykid)) errors.push(`MyKid berulang dalam fail: ${p.name}`);
    seen.add(p.mykid);
  }
  if (!profiles.length && !errors.length) errors.push('Tiada halaman murid ditemui dalam PDF ini.');
  return { format, profiles, errors };
}
