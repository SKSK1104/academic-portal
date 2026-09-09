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
  if (value === null || value === undefined || value === '' || value === '#N/A') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
function clean(value: unknown): string { return String(value ?? '').trim().replace(/\s+/g, ' '); }

export async function parseArWorkbook(file: File): Promise<ArWorkbookRow[]> {
  const sheets = await readExcelFile(file);
  const out: ArWorkbookRow[] = [];

  for (const sheet of sheets) {
    const sheetName = sheet.sheet;
    const matrix = sheet.data as unknown[][];
    const className = clean(matrix[1]?.[1]).toUpperCase();
    const subjectLabel = clean(matrix[4]?.[1]).toUpperCase();
    const subjectCode = subjectCodeFromLabel(subjectLabel) || subjectCodeFromLabel(sheetName) || sheetName.toUpperCase();

    // The historical 2026 workbooks use rows 10+ for pupils and columns C/E/M for TOV/AR1/ETR.
    for (let i = 9; i < matrix.length; i += 1) {
      const row = matrix[i] || [];
      const studentName = clean(row[1]).toUpperCase();
      if (!studentName) continue;
      const tov = n(row[2]);
      const ar1 = n(row[4]);
      const gradeRaw = clean(row[5]).toUpperCase();
      const etr = n(row[12]);
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
