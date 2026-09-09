import readExcelFile from 'read-excel-file/browser';
import { gradeFromScore } from '../grade';
import { subjectCodeFromLabel } from '../subjects';

export interface ArWorkbookRow {
  fileName: string;
  sheetName: string;
  className: string;
  subjectCode: string;
  subjectLabel: string;
  studentName: string;
  tov: number | null;
  ar1: number | null;
  ar1Grade: string | null;
  etr: number | null;
}

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || String(value).trim() === '#N/A') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clean(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value: unknown) {
  return clean(value).toUpperCase();
}

function valueBesideLabel(matrix: unknown[][], label: string): string {
  const wanted = label.toUpperCase();
  for (const row of matrix.slice(0, 12)) {
    for (let c = 0; c < row.length; c += 1) {
      if (upper(row[c]) === wanted) return upper(row[c + 1]);
    }
  }
  return '';
}

function findMainHeaderRow(matrix: unknown[][]): number {
  return matrix.findIndex((row) => {
    const cells = row.map(upper);
    return cells.includes('NAMA') && cells.some((x) => x.includes('TOV')) && cells.some((x) => /AR\s*1/.test(x));
  });
}

function findSubHeaderRow(matrix: unknown[][], mainRow: number): number {
  for (let r = mainRow + 1; r <= Math.min(mainRow + 4, matrix.length - 1); r += 1) {
    const cells = matrix[r].map(upper);
    if (cells.filter((x) => x === 'MARKAH').length >= 2 && cells.filter((x) => x === 'GRED').length >= 2) return r;
  }
  return mainRow + 2;
}

function groupSpan(main: string[], matcher: (value: string) => boolean): [number, number] | null {
  const start = main.findIndex(matcher);
  if (start < 0) return null;
  const next = main.findIndex((value, index) => index > start && value !== '');
  return [start, next < 0 ? main.length - 1 : next - 1];
}

function fieldColumns(main: string[], sub: string[], matcher: (value: string) => boolean) {
  const span = groupSpan(main, matcher);
  if (!span) return { score: null as number | null, grade: null as number | null };
  const [start, end] = span;
  let score: number | null = null;
  let grade: number | null = null;
  for (let c = start; c <= end; c += 1) {
    if (sub[c] === 'MARKAH' && score === null) score = c;
    if (sub[c] === 'GRED' && grade === null) grade = c;
  }
  return { score: score ?? start, grade };
}

export async function parseArWorkbook(file: File): Promise<ArWorkbookRow[]> {
  const sheets = await readExcelFile(file);
  const out: ArWorkbookRow[] = [];

  for (const sheet of sheets) {
    const sheetName = sheet.sheet;
    const matrix = sheet.data as unknown[][];
    const className = valueBesideLabel(matrix, 'KELAS');
    const subjectLabel = valueBesideLabel(matrix, 'M/P');
    const subjectCode = subjectCodeFromLabel(subjectLabel) || subjectCodeFromLabel(sheetName) || (sheetName === 'MT' ? 'MAT' : sheetName.toUpperCase());

    const mainRow = findMainHeaderRow(matrix);
    if (mainRow < 0) continue;
    const subRow = findSubHeaderRow(matrix, mainRow);
    const main = matrix[mainRow].map(upper);
    const sub = (matrix[subRow] || []).map(upper);
    const tovCols = fieldColumns(main, sub, (x) => x.includes('TOV'));
    const ar1Cols = fieldColumns(main, sub, (x) => /AR\s*1/.test(x));
    const etrCols = fieldColumns(main, sub, (x) => x.includes('ETR'));

    for (let i = subRow + 1; i < matrix.length; i += 1) {
      const row = matrix[i] || [];
      const serial = n(row[0]);
      const studentName = upper(row[1]);
      if (serial === null || !studentName) continue;

      const tov = tovCols.score === null ? null : n(row[tovCols.score]);
      const ar1 = ar1Cols.score === null ? null : n(row[ar1Cols.score]);
      const gradeRaw = ar1Cols.grade === null ? '' : upper(row[ar1Cols.grade]);
      const etr = etrCols.score === null ? null : n(row[etrCols.score]);

      out.push({
        fileName: file.name,
        sheetName,
        className,
        subjectCode,
        subjectLabel,
        studentName,
        tov,
        ar1,
        ar1Grade: ar1 === null ? null : (gradeRaw && gradeRaw !== '#N/A' ? gradeRaw : gradeFromScore(ar1)),
        etr
      });
    }
  }

  return out;
}
