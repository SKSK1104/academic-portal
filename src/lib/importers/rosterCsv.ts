import Papa from 'papaparse';

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
  okuStatus: string | null;
  okuCategory: string | null;
  okuSubcategory: string | null;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function parseYearLevel(value: unknown): number {
  const text = normalizeHeader(value);
  const map: Record<string, number> = {
    'TAHUN SATU': 1,
    'TAHUN DUA': 2,
    'TAHUN TIGA': 3,
    'TAHUN EMPAT': 4,
    'TAHUN LIMA': 5,
    'TAHUN ENAM': 6
  };
  if (map[text]) return map[text];
  const match = text.match(/([1-6])/);
  return match ? Number(match[1]) : 0;
}

export async function parseRosterCsv(file: File): Promise<RosterImportRow[]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const rows = parsed.data;

  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'ID MURID'));
  if (headerIndex < 0) throw new Error('Baris tajuk "ID MURID" tidak ditemui dalam CSV.');

  const headers = rows[headerIndex].map(normalizeHeader);
  const idx = (name: string) => headers.indexOf(normalizeHeader(name));

  const columns = {
    studentId: idx('ID MURID'),
    name: idx('NAMA'),
    mykid: idx('NO. PENGENALAN'),
    dob: idx('TARIKH LAHIR'),
    year: idx('TAHUN / TINGKATAN'),
    className: idx('NAMA KELAS'),
    classTeacher: idx('NAMA GURU KELAS'),
    gender: idx('JANTINA'),
    ethnicity: idx('KAUM'),
    religion: idx('AGAMA'),
    okuStatus: idx('STATUS OKU'),
    okuCategory: idx('KATEGORI KETIDAKUPAYAAN'),
    okuSubcategory: idx('SUBKATEGORI KETIDAKUPAYAAN')
  };

  for (const required of ['studentId', 'name', 'mykid', 'year', 'className'] as const) {
    if (columns[required] < 0) throw new Error(`Lajur wajib ${required} tidak ditemui.`);
  }

  return rows.slice(headerIndex + 1)
    .map((row) => ({
      studentId: String(row[columns.studentId] ?? '').trim(),
      name: String(row[columns.name] ?? '').trim().toUpperCase(),
      mykid: String(row[columns.mykid] ?? '').replace(/\D/g, ''),
      dob: columns.dob >= 0 ? String(row[columns.dob] ?? '').trim() || null : null,
      yearLevel: parseYearLevel(row[columns.year]),
      className: String(row[columns.className] ?? '').trim().toUpperCase(),
      classTeacher: columns.classTeacher >= 0 ? String(row[columns.classTeacher] ?? '').trim().toUpperCase() || null : null,
      gender: columns.gender >= 0 ? String(row[columns.gender] ?? '').trim().toUpperCase() || null : null,
      ethnicity: columns.ethnicity >= 0 ? String(row[columns.ethnicity] ?? '').trim().toUpperCase() || null : null,
      religion: columns.religion >= 0 ? String(row[columns.religion] ?? '').trim().toUpperCase() || null : null,
      okuStatus: columns.okuStatus >= 0 ? String(row[columns.okuStatus] ?? '').trim().toUpperCase() || null : null,
      okuCategory: columns.okuCategory >= 0 ? String(row[columns.okuCategory] ?? '').trim().toUpperCase() || null : null,
      okuSubcategory: columns.okuSubcategory >= 0 ? String(row[columns.okuSubcategory] ?? '').trim().toUpperCase() || null : null
    }))
    .filter((row) => row.studentId && row.name && row.mykid && row.yearLevel && row.className);
}
