import { supabase } from '../supabase';
import type { ParsedPdfDocument } from '../types';

export async function parseAssessmentPdf(file: File, requestedKind: 'AUTO' | 'UASA' | 'PBD' = 'AUTO') {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') throw new Error('Fail mestilah PDF.');

  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const upload = await supabase.storage.from('assessment-imports').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'application/pdf'
  });
  if (upload.error) throw upload.error;

  const response = await supabase.functions.invoke<ParsedPdfDocument>('parse-assessment-pdf', {
    body: { storagePath: path, requestedKind }
  });
  if (response.error) throw response.error;
  if (!response.data) throw new Error('Parser tidak mengembalikan data.');
  return { storagePath: path, parsed: response.data };
}
