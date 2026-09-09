import { CheckCircle2, FileSpreadsheet, FileText, UploadCloud, Users, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { parseArWorkbook, type ArWorkbookRow } from '../lib/importers/arWorkbook';
import { parseAssessmentPdf } from '../lib/importers/pdfImport';
import { parseRosterCsv, type RosterImportRow } from '../lib/importers/rosterCsv';
import { subjectCodeFromLabel, religiousSubjectForStudent } from '../lib/subjects';
import { supabase } from '../lib/supabase';
import type { ParsedPdfDocument } from '../lib/types';

interface PreviewState {
  kind: 'ROSTER' | 'AR' | 'PDF';
  title: string;
  summary: string[];
  warnings: string[];
  payload: unknown;
  storagePath?: string;
}

function normalizeClassName(value: string) {
  return value.toUpperCase().replace(/^TAHUN\s+/, '').replace(/BESTARI/g, 'BISTARI').replace(/\s+/g, ' ').trim();
}
function normalizeName(value: string) { return value.toUpperCase().replace(/\s+/g, ' ').trim(); }

export function ImportCenterPage() {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear());
  const [pdfHint, setPdfHint] = useState<'AUTO' | 'UASA' | 'PBD'>('AUTO');
  const [history, setHistory] = useState<any[]>([]);

  const canConfirm = useMemo(() => preview && !busy, [preview, busy]);

  useEffect(() => { void loadHistory(); }, []);

  async function loadHistory() {
    const { data, error } = await supabase
      .from('v2_imports')
      .select('id,created_at,school_year,import_type,file_name,status,validation_summary')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setHistory(data || []);
  }

  async function handleRoster(files: FileList | null) {
    const file = files?.[0]; if (!file) return;
    setBusy(true); setStatus('');
    try {
      const rows = await parseRosterCsv(file);
      const classes = [...new Set(rows.map((r) => r.className))];
      setPreview({ kind: 'ROSTER', title: file.name, payload: rows, warnings: [], summary: [`${rows.length} murid`, `${classes.length} kelas`, `Tahun ${schoolYear}`] });
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function handleAr(files: FileList | null) {
    const selected = [...(files || [])]; if (!selected.length) return;
    setBusy(true); setStatus('');
    try {
      const nested = await Promise.all(selected.map(parseArWorkbook));
      const rows = nested.flat();
      const classes = [...new Set(rows.map((r) => r.className))];
      const subjects = [...new Set(rows.map((r) => r.subjectCode))];
      const warnings = rows.filter((r) => !r.ar1 && r.ar1 !== 0).length ? ['Baris tanpa AR1 akan mengimport TOV/ETR sahaja.'] : [];
      setPreview({ kind: 'AR', title: `${selected.length} fail AR1`, payload: rows, warnings, summary: [`${rows.length} rekod murid-subjek`, `${classes.length} kelas`, `${subjects.length} subjek`] });
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function handlePdf(files: FileList | null) {
    const file = files?.[0]; if (!file) return;
    setBusy(true); setStatus('Memuat naik dan membaca PDF...');
    try {
      const { parsed, storagePath } = await parseAssessmentPdf(file, pdfHint);
      const rowCount = parsed.rows?.length || 0;
      const summaryCount = parsed.summary?.length || 0;
      setPreview({
        kind: 'PDF', title: file.name, payload: parsed, storagePath,
        warnings: parsed.warnings || [],
        summary: [parsed.doc_type, `${parsed.class_name || 'Kelas tidak dikenal pasti'}`, rowCount ? `${rowCount} murid` : `${summaryCount} baris ringkasan`]
      });
      setStatus('');
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true); setStatus('Mengesahkan dan menyimpan...');
    try {
      if (preview.kind === 'ROSTER') {
        const rows = preview.payload as RosterImportRow[];
        await importRoster(rows);
        await recordSimpleImport('ROSTER_CSV', preview.title, { rows: rows.length, summary: preview.summary });
      }
      if (preview.kind === 'AR') {
        const rows = preview.payload as ArWorkbookRow[];
        const skipped = await importAr(rows);
        await recordSimpleImport('AR1_XLSX', preview.title, { rows: rows.length, skipped, summary: preview.summary });
      }
      if (preview.kind === 'PDF') await importPdf(preview.payload as ParsedPdfDocument, preview.storagePath || '');
      setStatus('Import berjaya disimpan.'); setPreview(null); await loadHistory();
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function recordSimpleImport(importType: string, fileName: string, metadata: Record<string, unknown>) {
    const { error } = await supabase.from('v2_imports').insert({
      school_year: schoolYear, import_type: importType, file_name: fileName, status: 'confirmed',
      detected_metadata: metadata, validation_summary: { completed: true }
    });
    if (error) throw error;
  }

  async function importRoster(rows: RosterImportRow[]) {
    const studentPayload = rows.map((r) => ({
      student_id: r.studentId, name: r.name, mykid: r.mykid, dob_text: r.dob,
      gender: r.gender, ethnicity: r.ethnicity, religion: r.religion,
      oku_status: r.okuStatus, oku_category: r.okuCategory, oku_subcategory: r.okuSubcategory,
      updated_at: new Date().toISOString()
    }));
    const s = await supabase.from('v2_students').upsert(studentPayload, { onConflict: 'student_id' }).select('id,student_id');
    if (s.error) throw s.error;
    const ids = new Map((s.data || []).map((x: any) => [x.student_id, x.id]));
    const enrolmentPayload = rows.map((r) => ({
      student_id: ids.get(r.studentId), school_year: schoolYear, year_level: r.yearLevel,
      class_name: normalizeClassName(r.className), class_teacher: r.classTeacher,
      updated_at: new Date().toISOString()
    })).filter((x) => x.student_id);
    const e = await supabase.from('v2_enrolments').upsert(enrolmentPayload, { onConflict: 'student_id,school_year' });
    if (e.error) throw e.error;
  }

  async function importAr(rows: ArWorkbookRow[]): Promise<number> {
    const { data: assessment, error: ae } = await supabase.from('v2_assessments').upsert({
      school_year: schoolYear, kind: 'AR', code: 'AR1', sequence_no: 1, title: 'Assessment Round 1', source_kind: 'xlsx', is_active: true
    }, { onConflict: 'school_year,code' }).select('*').single();
    if (ae) throw ae;
    const { data: subjects, error: se } = await supabase.from('v2_subjects').select('id,code');
    if (se) throw se;
    const subjectMap = new Map((subjects || []).map((x: any) => [x.code, x.id]));
    const { data: enrolments, error: ee } = await supabase.from('v2_enrolments').select('id,class_name,students(name)').eq('school_year', schoolYear);
    if (ee) throw ee;
    const enrolMap = new Map<string, string>();
    (enrolments || []).forEach((e: any) => enrolMap.set(`${normalizeClassName(e.class_name)}|${normalizeName(e.students?.name || '')}`, e.id));

    const missing: string[] = [];
    const benchmarkPayload: any[] = [];
    const markPayload: any[] = [];
    rows.forEach((r) => {
      const enrolmentId = enrolMap.get(`${normalizeClassName(r.className)}|${normalizeName(r.studentName)}`);
      const subjectId = subjectMap.get(r.subjectCode);
      if (!enrolmentId || !subjectId) { missing.push(`${r.className} / ${r.studentName} / ${r.subjectCode}`); return; }
      benchmarkPayload.push({ enrolment_id: enrolmentId, subject_id: subjectId, tov: r.tov, etr: r.etr, updated_at: new Date().toISOString() });
      if (r.ar1 !== null) markPayload.push({ assessment_id: assessment.id, enrolment_id: enrolmentId, subject_id: subjectId, score: r.ar1, grade: r.ar1Grade, source: 'xlsx', updated_at: new Date().toISOString() });
    });
    if (missing.length) console.warn('AR1 rows skipped because they are not in the current roster:', missing);
    const b = await supabase.from('v2_academic_benchmarks').upsert(benchmarkPayload, { onConflict: 'enrolment_id,subject_id' }); if (b.error) throw b.error;
    const m = await supabase.from('v2_academic_marks').upsert(markPayload, { onConflict: 'assessment_id,enrolment_id,subject_id' }); if (m.error) throw m.error;
    return missing.length;
  }

  async function importPdf(parsed: ParsedPdfDocument, storagePath: string) {
    if (!parsed.school_year) parsed.school_year = schoolYear;
    const { data: importRow, error: ie } = await supabase.from('v2_imports').insert({
      school_year: parsed.school_year, import_type: parsed.doc_type, file_name: preview?.title || 'PDF', storage_path: storagePath,
      status: 'confirmed', detected_metadata: parsed, validation_summary: { warnings: parsed.warnings || [] }
    }).select('id').single();
    if (ie) throw ie;

    if (parsed.doc_type === 'PBD_SUMMARY') return;
    if (!parsed.class_name || !parsed.rows?.length) throw new Error('PDF individu tidak mempunyai kelas atau baris murid yang sah.');

    const year = Number(parsed.school_year || schoolYear);
    const className = normalizeClassName(parsed.class_name);
    const { data: enrolments, error: ee } = await supabase.from('v2_enrolments').select('id,students(id,name,mykid,religion)').eq('school_year', year).eq('class_name', className);
    if (ee) throw ee;
    const byMykid = new Map<string, any>(); const byName = new Map<string, any>();
    (enrolments || []).forEach((e: any) => { if (e.students?.mykid) byMykid.set(String(e.students.mykid).replace(/\D/g, ''), e); byName.set(normalizeName(e.students?.name || ''), e); });
    const { data: subjects, error: se } = await supabase.from('v2_subjects').select('id,code'); if (se) throw se;
    const subjectMap = new Map((subjects || []).map((x: any) => [x.code, x.id]));

    const isUasa = parsed.doc_type === 'UASA_INDIVIDUAL';
    const kind = isUasa ? 'UASA' : 'PBD';
    const code = isUasa ? 'UASA' : derivePbdCode(parsed.activity || 'PBD');
    const { data: assessment, error: ae } = await supabase.from('v2_assessments').upsert({
      school_year: year, kind, code, title: parsed.activity || code, source_kind: 'pdf', is_active: true
    }, { onConflict: 'school_year,code' }).select('*').single(); if (ae) throw ae;

    const missing: string[] = []; const academic: any[] = []; const pbd: any[] = [];
    parsed.rows.forEach((row) => {
      const enrolment = (row.mykid ? byMykid.get(String(row.mykid).replace(/\D/g, '')) : null) || byName.get(normalizeName(row.student_name));
      if (!enrolment) { missing.push(row.student_name); return; }
      Object.entries(row.values || {}).forEach(([label, raw]) => {
        let codeHint = subjectCodeFromLabel(label) || label.toUpperCase();
        if (codeHint === 'PAI_PM') codeHint = religiousSubjectForStudent(enrolment.students?.religion);
        const subjectId = subjectMap.get(codeHint);
        if (!subjectId || raw === null || raw === '') return;
        if (isUasa) {
          const grade = String(raw).trim().toUpperCase();
          academic.push({ assessment_id: assessment.id, enrolment_id: enrolment.id, subject_id: subjectId, score: null, grade, source: 'pdf', source_import_id: importRow.id, updated_at: new Date().toISOString() });
        } else {
          const tp = Number(String(raw).replace(/[^1-6]/g, ''));
          if (tp >= 1 && tp <= 6) pbd.push({ assessment_id: assessment.id, enrolment_id: enrolment.id, subject_id: subjectId, tp, source_import_id: importRow.id, updated_at: new Date().toISOString() });
        }
      });
    });
    if (missing.length) throw new Error(`Murid tidak dapat dipadankan (${missing.length}): ${missing.slice(0, 5).join(', ')}`);
    if (academic.length) { const r = await supabase.from('v2_academic_marks').upsert(academic, { onConflict: 'assessment_id,enrolment_id,subject_id' }); if (r.error) throw r.error; }
    if (pbd.length) {
      const r = await supabase.from('v2_pbd_records').upsert(pbd, { onConflict: 'assessment_id,enrolment_id,subject_id' });
      if (r.error) throw r.error;
      await validatePbdSummary(importRow.id, year, className, pbd, subjects || []);
    }
  }

  async function validatePbdSummary(importId: string, year: number, className: string, pbdRows: any[], subjectRows: any[]) {
    const { data: summaries } = await supabase.from('v2_imports')
      .select('id,detected_metadata,created_at')
      .eq('school_year', year)
      .eq('import_type', 'PBD_SUMMARY')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(20);

    const summaryImport = (summaries || []).find((row: any) => normalizeClassName(row.detected_metadata?.class_name || '') === className);
    if (!summaryImport) {
      await supabase.from('v2_imports').update({ validation_summary: { verified_against_summary: false, note: 'Tiada PDF ringkasan kelas dipadankan.' } }).eq('id', importId);
      return;
    }

    const codeById = new Map((subjectRows || []).map((s: any) => [s.id, s.code]));
    const computed = new Map<string, { TP1:number;TP2:number;TP3:number;TP4:number;TP5:number;TP6:number;total:number }>();
    for (const row of pbdRows) {
      const code = codeById.get(row.subject_id);
      if (!code) continue;
      if (!computed.has(code)) computed.set(code, { TP1:0,TP2:0,TP3:0,TP4:0,TP5:0,TP6:0,total:0 });
      const c = computed.get(code)!;
      c[`TP${row.tp}` as keyof typeof c] += 1;
      c.total += 1;
    }

    const mismatches: string[] = [];
    for (const official of summaryImport.detected_metadata?.summary || []) {
      let code = subjectCodeFromLabel(official.subject_label || '');
      let actual;
      if (code === 'PAI_PM') {
        const pi = computed.get('PI'); const pm = computed.get('PM');
        actual = { TP1:0,TP2:0,TP3:0,TP4:0,TP5:0,TP6:0,total:0 };
        for (const src of [pi, pm]) if (src) for (const key of ['TP1','TP2','TP3','TP4','TP5','TP6','total'] as const) actual[key] += src[key];
      } else actual = code ? computed.get(code) : undefined;
      if (!actual) continue;
      for (const key of ['TP1','TP2','TP3','TP4','TP5','TP6','total'] as const) {
        const expected = Number(official[key] || 0);
        if (actual[key] !== expected) mismatches.push(`${official.subject_label} ${key}: PDF ringkasan ${expected}, rekod murid ${actual[key]}`);
      }
    }

    await supabase.from('v2_imports').update({ validation_summary: {
      verified_against_summary: mismatches.length === 0,
      summary_import_id: summaryImport.id,
      mismatches
    } }).eq('id', importId);
  }

  return <>
    <PageHeader eyebrow="AUTOMASI DATA" title="Import Center" description="Data diproses oleh portal. GitHub dan preprocessing tempatan tidak diperlukan untuk operasi biasa." />
    <div className="import-grid">
      <ImportBox icon={Users} title="Roster Murid" desc="CSV rasmi IDME. Menjadi sumber murid dan kelas." accept=".csv" onFiles={handleRoster}/>
      <ImportBox icon={FileSpreadsheet} title="Migrasi AR1" desc="Pilih semua fail Excel Tahun 1–6 sekali gus." accept=".xlsx,.xls" multiple onFiles={handleAr}/>
      <GlassCard className="import-box">
        <div className="import-icon"><FileText/></div><h2>UASA / PBD PDF</h2><p>Portal mengenal pasti format PDF dan mengekstrak data.</p>
        <select className="compact-select" value={pdfHint} onChange={(e) => setPdfHint(e.target.value as any)}><option value="AUTO">Auto Detect</option><option value="UASA">UASA</option><option value="PBD">PBD</option></select>
        <label className="upload-button"><UploadCloud size={17}/> Pilih PDF<input type="file" accept="application/pdf" hidden onChange={(e) => handlePdf(e.target.files)}/></label>
      </GlassCard>
    </div>

    <GlassCard className="year-import-card"><label>Tahun data <input type="number" value={schoolYear} onChange={(e) => setSchoolYear(Number(e.target.value))}/></label><span>Digunakan apabila sumber tidak menyatakan tahun dengan jelas.</span></GlassCard>

    {status && <div className={`notice ${status.includes('berjaya') ? 'success' : ''}`}>{status}</div>}
    {preview && <GlassCard className="preview-card"><div className="card-toolbar"><div><div className="eyebrow">PREVIEW IMPORT</div><h2>{preview.title}</h2></div><span className="status-chip"><CheckCircle2 size={15}/> Sedia disahkan</span></div>
      <div className="preview-summary">{preview.summary.map((x) => <div key={x}>{x}</div>)}</div>
      {preview.warnings.map((w) => <div className="warning-row" key={w}><XCircle size={15}/>{w}</div>)}
      <div className="preview-actions"><button className="btn btn-ghost" onClick={() => setPreview(null)}>Batal</button><button className="btn btn-success" disabled={!canConfirm} onClick={confirm}>{busy ? 'Memproses...' : 'Sahkan Import'}</button></div>
    </GlassCard>}

    <GlassCard className="history-card">
      <div className="card-toolbar"><div><div className="eyebrow">REKOD SISTEM</div><h2>Sejarah Import</h2></div><button className="btn btn-ghost" onClick={() => void loadHistory()}>Segar Semula</button></div>
      {!history.length ? <p className="muted">Belum ada import PDF yang direkodkan dalam Portal 2.0.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Tarikh</th><th>Jenis</th><th>Fail</th><th>Tahun</th><th>Status Validasi</th></tr></thead><tbody>{history.map((row) => {
        const validation = row.validation_summary || {};
        const verified = validation.verified_against_summary;
        const label = verified === true ? 'Disahkan' : verified === false ? 'Belum disahkan' : (validation.warnings?.length ? `${validation.warnings.length} amaran` : 'Import selesai');
        return <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('ms-MY')}</td><td>{row.import_type}</td><td>{row.file_name}</td><td>{row.school_year}</td><td><span className={`mini-status ${verified === true ? 'ok' : verified === false ? 'warn' : ''}`}>{label}</span></td></tr>;
      })}</tbody></table></div>}
    </GlassCard>
  </>;
}

function derivePbdCode(activity: string) {
  const text = activity.toUpperCase();
  if (text.includes('PERTENGAHAN')) return 'PBD-PERTENGAHAN';
  if (text.includes('AKHIR')) return 'PBD-AKHIR';
  return `PBD-${new Date().getMonth() + 1}`;
}

function ImportBox({ icon: Icon, title, desc, accept, multiple, onFiles }: { icon: any; title: string; desc: string; accept: string; multiple?: boolean; onFiles: (files: FileList | null) => void }) {
  return <GlassCard className="import-box"><div className="import-icon"><Icon/></div><h2>{title}</h2><p>{desc}</p><label className="upload-button"><UploadCloud size={17}/> Pilih Fail<input type="file" hidden accept={accept} multiple={multiple} onChange={(e) => onFiles(e.target.files)}/></label></GlassCard>;
}
