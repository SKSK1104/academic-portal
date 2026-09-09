import { CheckCircle2, FileText, UploadCloud, Users, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { parseAssessmentPdf, uploadAssessmentPdf } from '../lib/importers/pdfImport';
import { parseRosterCsv, type RosterImportRow } from '../lib/importers/rosterCsv';
import { subjectCodeFromLabel, religiousSubjectForStudent } from '../lib/subjects';
import { supabase } from '../lib/supabase';
import type { ParsedPdfDocument } from '../lib/types';

interface PreviewState {
  kind: 'ROSTER' | 'PDF';
  title: string;
  summary: string[];
  warnings: string[];
  blockers: string[];
  payload: unknown;
  file?: File;
}

type PbdRound = 'AUTO' | 'PBD1' | 'PBD2';

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
  const [pbdRound, setPbdRound] = useState<PbdRound>('AUTO');
  const [history, setHistory] = useState<any[]>([]);

  const parsedPreview = preview?.kind === 'PDF' ? preview.payload as ParsedPdfDocument : null;
  const roundForPreview = parsedPreview && isPbd(parsedPreview) ? resolvePbdRound(parsedPreview, pbdRound) : null;
  const canConfirm = useMemo(() => {
    if (!preview || busy || preview.blockers.length) return false;
    if (preview.kind === 'PDF' && parsedPreview && isPbd(parsedPreview) && !roundForPreview) return false;
    return true;
  }, [preview, busy, parsedPreview, roundForPreview]);

  useEffect(() => { void loadHistory(); }, []);

  async function loadHistory() {
    const { data, error } = await supabase
      .from('v2_imports')
      .select('id,created_at,school_year,import_type,file_name,status,validation_summary')
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setHistory(data || []);
  }

  async function handleRoster(files: FileList | null) {
    const file = files?.[0]; if (!file) return;
    setBusy(true); setStatus('');
    try {
      const rows = await parseRosterCsv(file);
      const classes = [...new Set(rows.map((r) => r.className))];
      setPreview({ kind: 'ROSTER', title: file.name, payload: rows, warnings: [], blockers: [], summary: [`${rows.length} murid`, `${classes.length} kelas`, `${schoolYear}`] });
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function handlePdf(files: FileList | null) {
    const file = files?.[0]; if (!file) return;
    setBusy(true); setStatus('Membaca PDF…');
    try {
      const parsed = await parseAssessmentPdf(file, pdfHint, setStatus);
      const rowCount = parsed.rows?.length || 0;
      const summaryCount = parsed.summary?.length || 0;
      const warnings = [...(parsed.warnings || [])];
      const blockers: string[] = [];
      const detectedYear = parsed.school_year ? Number(parsed.school_year) : null;

      if (detectedYear && detectedYear !== schoolYear) {
        blockers.push(`Tahun pada PDF ialah ${detectedYear}, bukan ${schoolYear}.`);
      }
      if (parsed.doc_type === 'UNKNOWN') blockers.push('Jenis dokumen tidak dapat dikenal pasti.');

      if (parsed.class_name && rowCount) {
        const expectedYear = detectedYear || schoolYear;
        const className = normalizeClassName(parsed.class_name);
        const roster = await supabase.from('v2_enrolments').select('id', { count: 'exact', head: true }).eq('school_year', expectedYear).eq('class_name', className);
        if (roster.error) throw roster.error;
        const rosterCount = roster.count || 0;
        if (rosterCount && rosterCount !== rowCount) warnings.push(`PDF: ${rowCount} murid • Roster: ${rosterCount} murid`);
      }

      setPreview({
        kind: 'PDF', title: file.name, payload: parsed, file, warnings, blockers,
        summary: [displayDocType(parsed.doc_type), parsed.class_name ? displayClass(parsed.class_name, parsed.year_level) : 'Kelas belum dikenal pasti', rowCount ? `${rowCount} murid` : `${summaryCount} baris ringkasan`]
      });
      setStatus('');
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!preview || !canConfirm) return;
    setBusy(true); setStatus('Mengesahkan dan menyimpan…');
    try {
      if (preview.kind === 'ROSTER') {
        const rows = preview.payload as RosterImportRow[];
        await importRoster(rows);
        const rosterType = preview.title.toLowerCase().endsWith('.xlsx') ? 'ROSTER_XLSX' : 'ROSTER_CSV';
        await recordSimpleImport(rosterType, preview.title, { rows: rows.length, summary: preview.summary });
      } else {
        const parsed = preview.payload as ParsedPdfDocument;
        if (!preview.file) throw new Error('Fail PDF tidak lagi tersedia. Pilih semula fail.');
        await importPdf(parsed, preview.file);
      }
      setStatus('Import berjaya disimpan.');
      setPreview(null);
      await loadHistory();
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
      student_id: r.studentId,
      name: r.name,
      mykid: r.mykid,
      dob_text: r.dob,
      gender: r.gender,
      ethnicity: r.ethnicity,
      religion: r.religion,
      hostel_status: r.hostelStatus,
      hostel_name: r.hostelName,
      oku_status: r.okuStatus,
      oku_verified_date: r.okuVerifiedDate,
      oku_registration_no: r.okuRegistrationNo,
      oku_registered_date: r.okuRegisteredDate,
      oku_card_date: r.okuCardDate,
      oku_category: r.okuCategory,
      oku_subcategory: r.okuSubcategory,
      orphan_status: r.orphanStatus,
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

  async function importPdf(parsed: ParsedPdfDocument, file: File) {
    const year = Number(parsed.school_year || schoolYear);
    if (parsed.school_year && Number(parsed.school_year) !== schoolYear) throw new Error(`PDF ini ialah tahun ${parsed.school_year}. Pilihan semasa ialah ${schoolYear}.`);
    if (parsed.doc_type === 'UNKNOWN') throw new Error('Jenis PDF tidak dapat dikenal pasti.');

    const isUasa = parsed.doc_type === 'UASA_INDIVIDUAL';
    const pbdCode = isPbd(parsed) ? resolvePbdRound(parsed, pbdRound) : null;
    if (isPbd(parsed) && !pbdCode) throw new Error('Pilih PBD 1 atau PBD 2 sebelum mengesahkan import.');

    if (isUasa) {
      const existing = await supabase.from('v2_assessments').select('id').eq('school_year', year).eq('kind', 'UASA').eq('code', 'UASA').limit(1);
      if (existing.error) throw existing.error;
      if ((existing.data || []).length) throw new Error(`UASA ${year} sudah wujud. Import tidak diteruskan untuk mengelakkan data ditindih.`);
    }

    const className = parsed.class_name ? normalizeClassName(parsed.class_name) : '';
    let matchedEnrolments: any[] = [];
    let subjects: any[] = [];
    const missing: string[] = [];

    if (parsed.doc_type !== 'PBD_SUMMARY') {
      if (!className || !parsed.rows?.length) throw new Error('PDF individu tidak mempunyai kelas atau baris murid yang sah.');
      const er = await supabase.from('v2_enrolments')
        .select('id,students:v2_students!v2_enrolments_student_id_fkey(id,name,mykid,religion)')
        .eq('school_year', year).eq('class_name', className);
      if (er.error) throw er.error;
      matchedEnrolments = er.data || [];
      const sr = await supabase.from('v2_subjects').select('id,code');
      if (sr.error) throw sr.error;
      subjects = sr.data || [];

      const byMykid = new Map<string, any>();
      const byName = new Map<string, any>();
      matchedEnrolments.forEach((e: any) => {
        if (e.students?.mykid) byMykid.set(String(e.students.mykid).replace(/\D/g, ''), e);
        byName.set(normalizeName(e.students?.name || ''), e);
      });
      parsed.rows.forEach((row) => {
        const enrolment = (row.mykid ? byMykid.get(String(row.mykid).replace(/\D/g, '')) : null) || byName.get(normalizeName(row.student_name));
        if (!enrolment) missing.push(row.student_name);
      });
      if (missing.length) throw new Error(`Murid tidak dapat dipadankan (${missing.length}): ${missing.slice(0, 5).join(', ')}`);
    }

    const storagePath = await uploadAssessmentPdf(file, year);
    const metadata = isPbd(parsed) ? { ...parsed, pbd_round: pbdCode } : parsed;
    const { data: importRow, error: ie } = await supabase.from('v2_imports').insert({
      school_year: year, import_type: parsed.doc_type, file_name: file.name, storage_path: storagePath,
      status: 'confirmed', detected_metadata: metadata, validation_summary: { warnings: parsed.warnings || [] }
    }).select('id').single();
    if (ie) throw ie;

    if (parsed.doc_type === 'PBD_SUMMARY') return;

    const kind = isUasa ? 'UASA' : 'PBD';
    const code = isUasa ? 'UASA' : pbdCode!;
    const title = isUasa ? `UASA ${year}` : `${code} ${year}`;
    const { data: assessment, error: ae } = await supabase.from('v2_assessments').upsert({
      school_year: year, kind, code, title, source_kind: 'pdf', is_active: true,
      sequence_no: isUasa ? null : code === 'PBD1' ? 1 : 2
    }, { onConflict: 'school_year,code' }).select('*').single();
    if (ae) throw ae;

    const subjectMap = new Map(subjects.map((x: any) => [x.code, x.id]));
    const byMykid = new Map<string, any>();
    const byName = new Map<string, any>();
    matchedEnrolments.forEach((e: any) => {
      if (e.students?.mykid) byMykid.set(String(e.students.mykid).replace(/\D/g, ''), e);
      byName.set(normalizeName(e.students?.name || ''), e);
    });

    const academic: any[] = [];
    const pbd: any[] = [];
    parsed.rows!.forEach((row) => {
      const enrolment = (row.mykid ? byMykid.get(String(row.mykid).replace(/\D/g, '')) : null) || byName.get(normalizeName(row.student_name));
      if (!enrolment) return;
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

    if (academic.length) {
      const r = await supabase.from('v2_academic_marks').upsert(academic, { onConflict: 'assessment_id,enrolment_id,subject_id' });
      if (r.error) throw r.error;
    }
    if (pbd.length) {
      const r = await supabase.from('v2_pbd_records').upsert(pbd, { onConflict: 'assessment_id,enrolment_id,subject_id' });
      if (r.error) throw r.error;
      await validatePbdSummary(importRow.id, year, className, pbd, subjects, pbdCode!);
    }
  }

  async function validatePbdSummary(importId: string, year: number, className: string, pbdRows: any[], subjectRows: any[], pbdCode: string) {
    const { data: summaries } = await supabase.from('v2_imports')
      .select('id,detected_metadata,created_at')
      .eq('school_year', year)
      .eq('import_type', 'PBD_SUMMARY')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(30);

    const sameClass = (summaries || []).filter((row: any) => normalizeClassName(row.detected_metadata?.class_name || '') === className);
    const summaryImport = sameClass.find((row: any) => row.detected_metadata?.pbd_round === pbdCode) || sameClass.find((row: any) => !row.detected_metadata?.pbd_round);
    if (!summaryImport) {
      await supabase.from('v2_imports').update({ validation_summary: { verified_against_summary: false, note: 'Ringkasan PBD belum tersedia untuk kelas dan pusingan ini.' } }).eq('id', importId);
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
      const subjectCode = subjectCodeFromLabel(official.subject_label || '');
      let actual;
      if (subjectCode === 'PAI_PM') {
        const pi = computed.get('PI'); const pm = computed.get('PM');
        actual = { TP1:0,TP2:0,TP3:0,TP4:0,TP5:0,TP6:0,total:0 };
        for (const src of [pi, pm]) if (src) for (const key of ['TP1','TP2','TP3','TP4','TP5','TP6','total'] as const) actual[key] += src[key];
      } else actual = subjectCode ? computed.get(subjectCode) : undefined;
      if (!actual) continue;
      for (const key of ['TP1','TP2','TP3','TP4','TP5','TP6','total'] as const) {
        const expected = Number(official[key] || 0);
        if (actual[key] !== expected) mismatches.push(`${official.subject_label} ${key}: ringkasan ${expected}, rekod murid ${actual[key]}`);
      }
    }

    await supabase.from('v2_imports').update({ validation_summary: {
      verified_against_summary: mismatches.length === 0,
      summary_import_id: summaryImport.id,
      mismatches
    } }).eq('id', importId);
  }

  return <>
    <PageHeader title="Import Data" />

    <GlassCard className="assessment-import-panel">
      <div className="assessment-import-heading"><FileText size={22}/><h2>Import Pentaksiran</h2></div>
      <div className="assessment-import-controls">
        <label>Jenis<select value={pdfHint} onChange={(e) => { setPdfHint(e.target.value as any); setPreview(null); }}><option value="AUTO">Auto Detect</option><option value="PBD">PBD</option><option value="UASA">UASA</option></select></label>
        <label>Tahun<input type="number" value={schoolYear} onChange={(e) => setSchoolYear(Number(e.target.value))}/></label>
        <label>Pusingan PBD<select value={pbdRound} onChange={(e) => setPbdRound(e.target.value as PbdRound)} disabled={pdfHint === 'UASA'}><option value="AUTO">Auto Detect</option><option value="PBD1">PBD 1</option><option value="PBD2">PBD 2</option></select></label>
        <label className="primary-upload"><span>Fail PDF</span><span className="upload-button"><UploadCloud size={17}/> Pilih PDF<input type="file" accept="application/pdf" hidden onChange={(e) => handlePdf(e.target.files)}/></span></label>
      </div>
    </GlassCard>

    {status && <div className={`notice ${status.includes('berjaya') ? 'success' : ''}`}>{status}</div>}

    {preview && <GlassCard className="preview-card">
      <div className="card-toolbar"><div><h2>{preview.title}</h2></div><span className="status-chip"><CheckCircle2 size={15}/> Pratonton</span></div>
      <div className="preview-summary">{preview.summary.map((x) => <div key={x}>{x}</div>)}</div>
      {preview.kind === 'PDF' && parsedPreview && isPbd(parsedPreview) && !roundForPreview && <div className="warning-row"><XCircle size={15}/> Pilih PBD 1 atau PBD 2.</div>}
      {preview.warnings.map((w) => <div className="warning-row" key={w}><XCircle size={15}/>{w}</div>)}
      {preview.blockers.map((w) => <div className="warning-row blocker" key={w}><XCircle size={15}/>{w}</div>)}
      <div className="preview-actions"><button className="btn btn-ghost" onClick={() => setPreview(null)}>Batal</button><button className="btn btn-primary" disabled={!canConfirm} onClick={confirm}>{busy ? 'Memproses…' : 'Sahkan Import'}</button></div>
    </GlassCard>}

    <section className="data-maintenance">
      <div className="section-heading"><h2>Pengurusan Data</h2></div>
      <GlassCard className="maintenance-row"><div className="maintenance-identity"><Users size={20}/><strong>Roster Murid</strong></div><label className="btn btn-ghost">Pilih Fail<input type="file" hidden accept=".xlsx,.csv" onChange={(e) => handleRoster(e.target.files)}/></label></GlassCard>
    </section>

    <GlassCard className="history-card">
      <div className="card-toolbar"><div><h2>Sejarah Import</h2></div><button className="btn btn-ghost" onClick={() => void loadHistory()}>Segar Semula</button></div>
      {!history.length ? <div className="empty-inline">Belum ada sejarah import.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Tarikh</th><th>Jenis</th><th>Fail</th><th>Tahun</th><th>Status</th></tr></thead><tbody>{history.map((row) => {
        const validation = row.validation_summary || {};
        const verified = validation.verified_against_summary;
        const label = verified === true ? 'Disahkan' : verified === false ? 'Semakan diperlukan' : (validation.warnings?.length ? `${validation.warnings.length} amaran` : 'Selesai');
        return <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('ms-MY')}</td><td>{displayImportType(row.import_type)}</td><td>{row.file_name}</td><td>{row.school_year}</td><td><span className={`mini-status ${verified === true ? 'ok' : verified === false ? 'warn' : ''}`}>{label}</span></td></tr>;
      })}</tbody></table></div>}
    </GlassCard>
  </>;
}

function isPbd(parsed: ParsedPdfDocument) { return parsed.doc_type === 'PBD_INDIVIDUAL' || parsed.doc_type === 'PBD_SUMMARY'; }
function resolvePbdRound(parsed: ParsedPdfDocument, choice: PbdRound): 'PBD1' | 'PBD2' | null {
  if (choice === 'PBD1' || choice === 'PBD2') return choice;
  const text = String(parsed.activity || '').toUpperCase();
  if (text.includes('PERTENGAHAN') || text.includes('PBD 1') || text.includes('PBD1')) return 'PBD1';
  if (text.includes('AKHIR') || text.includes('PBD 2') || text.includes('PBD2')) return 'PBD2';
  return null;
}
function displayDocType(value: ParsedPdfDocument['doc_type']) {
  if (value === 'PBD_INDIVIDUAL') return 'PBD';
  if (value === 'PBD_SUMMARY') return 'Ringkasan PBD';
  if (value === 'UASA_INDIVIDUAL') return 'UASA';
  return 'Tidak dikenal pasti';
}
function displayImportType(value: string) {
  const labels: Record<string,string> = { PBD_INDIVIDUAL:'PBD', PBD_SUMMARY:'Ringkasan PBD', UASA_INDIVIDUAL:'UASA', ROSTER_XLSX:'Roster', ROSTER_CSV:'Roster', AR1_XLSX:'AR1', AR1_XLSX_RECONCILED:'AR1' };
  return labels[value] || value.replaceAll('_',' ');
}
function displayClass(value: string, yearLevel?: number | null) {
  const clean = normalizeClassName(value).toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return yearLevel ? `${yearLevel} ${clean}` : clean;
}
