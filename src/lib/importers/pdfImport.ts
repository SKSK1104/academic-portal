import { supabase } from '../supabase';
import type { ParsedPdfDocument } from '../types';
import { parsePdfLocally } from './localPdfOcr';

function normalizeParsedClassName(value: string | null | undefined) {
  if (!value) return value;
  return value
    .toUpperCase()
    .replace(/^TAHUN\s*[1-6]\s*[-–—:]?\s*/i, '')
    .replace(/^[1-6]\s*[-–—:]?\s*/i, '')
    .replace(/^KELAS\s+/i, '')
    .replace(/BESTARI/g, 'BISTARI')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function parseAssessmentPdf(
  file: File,
  requestedKind: 'AUTO' | 'UASA' | 'PBD' = 'AUTO',
  onProgress?: (message: string) => void
): Promise<ParsedPdfDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') throw new Error('Fail mestilah PDF.');

  onProgress?.('Membaca PDF dalam pelayar...');
  const parsed = await parsePdfLocally(file, requestedKind, onProgress);

  if (parsed.class_name) {
    parsed.class_name = normalizeParsedClassName(parsed.class_name) || parsed.class_name;
  }

  return parsed;
}

export async function uploadAssessmentPdf(file: File, schoolYear: number) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${schoolYear}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from('assessment-imports').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'application/pdf'
  });
  if (upload.error) throw upload.error;
  return path;
}
