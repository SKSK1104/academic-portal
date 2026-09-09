import Papa from 'papaparse';
import readExcelFile from 'read-excel-file/browser';

export interface RosterImportRow {
  studentId: string;
  name: string;
  mykid: string;
  dob: string | null;
  yearLevel: number;
  className: string;
  classTeacher: string | null;
  gender: string | null;
  ethnicity: string | null;
  religion: string | null;
  hostelStatus: string | null;
  hostelName: string | null;
  okuStatus: string | null;
  okuVerifiedDate: string | null;
  okuRegistrationNo: string | null;
  okuRegisteredDate: string | null;
  okuCardDate: string | null;
  okuCategory: string | null;
  okuSubcategory: string | null;
  orphanStatus: string | null;
}

type Matrix = unknown[][];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function upperOrNull(value: unknown): string | null {
  const valueText = text(value);
  return valueText ? valueText.toUpperCase() : null;
}

function dateOrNull(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${value.getFullYear()}`;
  }
  return text(value) || null;
}

function parseYearLevel(value: unknown): number {
  const valueText = normalizeHeader(value);
  const words: Record<string, number> = {
    'TAHUN SATU': 1,
    'TAHUN DUA': 2,
    'TAHUN TIGA': 3,
    'TAHUN EMPAT': 4,
    'TAHUN LIMA': 5,
    'TAHUN ENAM': 6
  };
  if (words[valueText]) return words[valueText];
  const match = valueText.match(/(?:TAHUN\s*)?([1-6])/);
  return match ? Number(match[1]) : 0;
}

function rowsFromMatrix(rows: Matrix): RosterImportRow[] {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'ID MURID'));
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map(normalizeHeader);
  const idx = (...names: string[]) => {
    for (const name of names) {
      const index = headers.indexOf(normalizeHeader(name));
      if (index >= 0) return index;
    }
    return -1;
  };

  const columns = {
    studentId: idx('ID MURID'),
    name: idx('NAMA'),
    mykid: idx('NO. PENGENALAN', 'NO PENGENALAN', 'MYKID'),
    dob: idx('TARIKH LAHIR'),
    year: idx('TAHUN / TINGKATAN', 'TAHUN/TINGKATAN', 'TAHUN'),
    className: idx('NAMA KELAS', 'KELAS'),
    classTeacher: idx('NAMA GURU KELAS', 'GURU KELAS'),
    gender: idx('JANTINA'),
    ethnicity: idx('KAUM'),
    religion: idx('AGAMA'),
    hostelStatus: idx('STATUS ASRAMA'),
    hostelName: idx('NAMA ASRAMA'),
    okuStatus: idx('STATUS OKU'),
    okuVerifiedDate: idx('TARIKH SAH OKU'),
    okuRegistrationNo: idx('NO. PENDAFTARAN OKU', 'NO PENDAFTARAN OKU'),
    okuRegisteredDate: idx('TARIKH DAFTAR OKU'),
    okuCardDate: idx('TARIKH KAD OKU'),
    okuCategory: idx('KATEGORI KETIDAKUPAYAAN'),
    okuSubcategory: idx('SUBKATEGORI KETIDAKUPAYAAN'),
    orphanStatus: idx('STATUS YATIM')
  };

  for (const required of ['studentId', 'name', 'mykid', 'year', 'className'] as const) {
    if (columns[required] < 0) throw new Error(`Lajur wajib ${required} tidak ditemui.`);
  }

  return rows.slice(headerIndex + 1)
    .map((row) => ({
      studentId: text(row[columns.studentId]),
      name: text(row[columns.name]).toUpperCase(),
      mykid: text(row[columns.mykid]).replace(/\D/g, ''),
      dob: columns.dob >= 0 ? dateOrNull(row[columns.dob]) : null,
      yearLevel: parseYearLevel(row[columns.year]),
      className: text(row[columns.className]).toUpperCase(),
      classTeacher: columns.classTeacher >= 0 ? upperOrNull(row[columns.classTeacher]) : null,
      gender: columns.gender >= 0 ? upperOrNull(row[columns.gender]) : null,
      ethnicity: columns.ethnicity >= 0 ? upperOrNull(row[columns.ethnicity]) : null,
      religion: columns.religion >= 0 ? upperOrNull(row[columns.religion]) : null,
      hostelStatus: columns.hostelStatus >= 0 ? upperOrNull(row[columns.hostelStatus]) : null,
      hostelName: columns.hostelName >= 0 ? upperOrNull(row[columns.hostelName]) : null,
      okuStatus: columns.okuStatus >= 0 ? upperOrNull(row[columns.okuStatus]) : null,
      okuVerifiedDate: columns.okuVerifiedDate >= 0 ? dateOrNull(row[columns.okuVerifiedDate]) : null,
      okuRegistrationNo: columns.okuRegistrationNo >= 0 ? upperOrNull(row[columns.okuRegistrationNo]) : null,
      okuRegisteredDate: columns.okuRegisteredDate >= 0 ? dateOrNull(row[columns.okuRegisteredDate]) : null,
      okuCardDate: columns.okuCardDate >= 0 ? dateOrNull(row[columns.okuCardDate]) : null,
      okuCategory: columns.okuCategory >= 0 ? upperOrNull(row[columns.okuCategory]) : null,
      okuSubcategory: columns.okuSubcategory >= 0 ? upperOrNull(row[columns.okuSubcategory]) : null,
      orphanStatus: columns.orphanStatus >= 0 ? upperOrNull(row[columns.orphanStatus]) : null
    }))
    .filter((row) => row.studentId && row.name && row.mykid && row.yearLevel && row.className);
}

export async function parseRosterCsv(file: File): Promise<RosterImportRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx') {
    const sheets = await readExcelFile(file);
    const rows = sheets.flatMap((sheet) => rowsFromMatrix(sheet.data as Matrix));
    if (!rows.length) throw new Error('Tiada roster murid yang sah ditemui dalam fail Excel.');
    return rows;
  }

  if (extension === 'xls') {
    throw new Error('Format .xls lama tidak disokong. Simpan sebagai .xlsx dan cuba semula.');
  }

  const csv = await file.text();
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: false });
  const rows = rowsFromMatrix(parsed.data);
  if (!rows.length) throw new Error('Baris tajuk "ID MURID" tidak ditemui dalam roster.');
  return rows;
}
