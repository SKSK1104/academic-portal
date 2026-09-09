import { supabase } from '../supabase';
import type { ParsedPdfDocument } from '../types';
import { parsePdfLocally } from './localPdfOcr';

export async function parseAssessmentPdf(
  file: File,
  requestedKind: 'AUTO' | 'UASA' | 'PBD' = 'AUTO',
  onProgress?: (message: string) => void
) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') throw new Error('Fail mestilah PDF.');

  onProgress?.('Membaca PDF dalam pelayar...');
  const parsed: ParsedPdfDocument = await parsePdfLocally(file, requestedKind, onProgress);

  onProgress?.('Menyimpan salinan asal secara peribadi...');
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const upload = await supabase.storage.from('assessment-imports').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'application/pdf'
  });
  if (upload.error) throw upload.error;

  return { storagePath: path, parsed };
}
