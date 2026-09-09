import { supabase } from '../supabase';
import type { ParsedPdfDocument } from '../types';
import { parsePdfLocally } from './localPdfOcr';

export async function parseAssessmentPdf(
  file: File,
  requestedKind: 'AUTO' | 'UASA' | 'PBD' = 'AUTO',
  onProgress?: (message: string) => void
): Promise<ParsedPdfDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') throw new Error('Fail mestilah PDF.');

  onProgress?.('Membaca PDF dalam pelayar...');
  return parsePdfLocally(file, requestedKind, onProgress);
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
