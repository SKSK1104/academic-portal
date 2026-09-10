import { ArrowUpRight, BookOpenCheck, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';

type AcademicRow = {
  assessment:string; assessment_title:string; assessment_kind:string; sequence_no:number|null; school_year:number|null;
  subject_code:string; subject:string; score:number|null; grade:string|null;
};
type PbdRow = {
  assessment:string; assessment_title:string; sequence_no:number|null; school_year:number|null;
  subject_code:string; subject:string; tp:number;
};
interface ParentReport {
  student:{name:string;student_id:string;class_name:string;year_level:number;school_year:number};
  academic:AcademicRow[];
  pbd:PbdRow[];
}

export function ParentSearchPage(){
  const [mykid,setMykid]=useState('');
  const [report,setReport]=useState<ParentReport|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault();
    const clean=mykid.replace(/\D/g,'');
    if(clean.length!==12){setMessage('Masukkan nombor MyKid 12 digit.');return;}
    setBusy(true);setMessage('');setReport(null);
    const {data,error}=await supabase.functions.invoke<ParentReport>('parent-report',{body:{mykid:clean}});
    if(error||!data){setMessage('Rekod murid tidak ditemui. Sila semak nombor MyKid.');}
    else setReport(data);
    setBusy(false);
  }

  const academicAssessments=useMemo(()=>{
    if(!report)return [];
    const map=new Map<string,{code:string;sequence:number;year:number}>();
    report.academic.forEach(r=>map.set(r.assessment,{code:r.assessment,sequence:Number(r.sequence_no||0),year:Number(r.school_year||0)}));
    return [...map.values()].sort((a,b)=>a.year-b.year||a.sequence-b.sequence||a.code.localeCompare(b.code));
  },[report]);

  const academicTrend=useMemo(()=>academicAssessments.map(a=>{
    const rows=report?.academic.filter(r=>r.assessment===a.code&&r.score!==null)||[];
    const avg=rows.length?rows.reduce((s,r)=>s+Number(r.score||0),0)/rows.length:null;
    return {assessment:a.code,average:avg===null?0:Number(avg.toFixed(1)),hasData:avg!==null};
  }),[academicAssessments,report]);

  const academicSubjects=useMemo(()=>{
    if(!report)return [];
    const map=new Map<string,string>();
    report.academic.forEach(r=>map.set(r.subject_code||r.subject,r.subject));
    return [...map.entries()].map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
  },[report]);

  const pbdAssessments=useMemo(()=>{
    if(!report)return [];
    const map=new Map<string,{code:string;sequence:number;year:number}>();
    report.pbd.forEach(r=>map.set(r.assessment,{code:r.assessment,sequence:Number(r.sequence_no||0),year:Number(r.school_year||0)}));
    return [...map.values()].sort((a,b)=>a.year-b.year||a.sequence-b.sequence||a.code.localeCompare(b.code));
  },[report]);

  const latestPbd=pbdAssessments[pbdAssessments.length-1]?.code||'';
  const tpDistribution=useMemo(()=>[1,2,3,4,5,6].map(tp=>({tp:`TP${tp}`,count:report?.pbd.filter(r=>r.assessment===latestPbd&&r.tp===tp).length||0})),[report,latestPbd]);
  const pbdSubjects=useMemo(()=>{
    if(!report)return [];
    const map=new Map<string,string>();
    report.pbd.forEach(r=>map.set(r.subject_code||r.subject,r.subject));
    return [...map.entries()].map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
  },[report]);

  const latestAcademic=academicAssessments[academicAssessments.length-1]?.code||'';
  const latestRows=report?.academic.filter(r=>r.assessment===latestAcademic)||[];
  const scoredLatest=latestRows.filter(r=>r.score!==null);
  const averageLatest=scoredLatest.length?scoredLatest.reduce((s,r)=>s+Number(r.score||0),0)/scoredLatest.length:null;
  const mtmSubjects=latestRows.filter(r=>r.grade&&['A','B','C','D','E'].includes(r.grade)).length;
  const latestPbdRows=report?.pbd.filter(r=>r.assessment===latestPbd)||[];
  const pbdMtm=latestPbdRows.filter(r=>r.tp>=3).length;

  return <div className={`parent-page ${report?'has-report':''}`}>
    {!report&&<>
      <PageHeader title="Semakan Ibu Bapa" />
      <section className="parent-lookup-stage">
        <div className="lookup-copy">
          <h1>Prestasi anak,<br/>dalam satu pandangan.</h1>
          <p>Masukkan MyKid untuk melihat rekod akademik dan PBD yang direkodkan oleh sekolah.</p>
        </div>
        <GlassCard className="parent-search-card premium-parent-card">
          <form onSubmit={submit}>
            <label>MyKid</label>
            <div className="parent-search-row"><input inputMode="numeric" maxLength={14} value={mykid} onChange={e=>setMykid(e.target.value)} placeholder="Contoh: 19010113XXXX"/><button className="btn btn-primary parent-search-button" disabled={busy}><Search size={18}/>{busy?'Menyemak...':'Semak'}</button></div>
          </form>
          <div className="privacy-note"><ShieldCheck size={15}/>Carian terus ke rekod murid yang sepadan.</div>
          {message&&<div className="notice">{message}</div>}
        </GlassCard>
      </section>
    </>}

    {report&&<div className="parent-report premium-parent-report">
      <section className="parent-report-hero">
        <button className="parent-new-search" onClick={()=>{setReport(null);setMykid('');setMessage('')}}><Search size={15}/> Semakan baharu</button>
        <div className="parent-student-overline">LAPORAN PRESTASI {report.student.school_year}</div>
        <h1>{report.student.name}</h1>
        <div className="parent-identity-line"><span>ID Murid <strong>{report.student.student_id}</strong></span><span>Kelas <strong>{report.student.year_level} {formatClass(report.student.class_name)}</strong></span></div>
      </section>

      <section className="parent-kpi-rail">
        <div><span>Purata {latestAcademic||'Akademik'}</span><strong>{averageLatest===null?'—':averageLatest.toFixed(1)}</strong><small>/ 100</small></div>
        <div><span>Subjek MTM</span><strong>{mtmSubjects}</strong><small>{latestAcademic||'—'}</small></div>
        <div><span>Penguasaan PBD</span><strong>{latestPbdRows.length?Math.round((pbdMtm/latestPbdRows.length)*100):0}%</strong><small>TP3–TP6 · {latestPbd||'—'}</small></div>
        <div className="parent-kpi-signature"><Sparkles size={18}/><span>Rekod sekolah<br/><strong>dikemas kini</strong></span></div>
      </section>

      <section className="parent-dashboard-grid">
        <GlassCard className="parent-chart-card parent-chart-wide premium-parent-card">
          <div className="parent-section-head"><div><span>AKADEMIK</span><h2>Perkembangan Prestasi</h2></div><ArrowUpRight size={22}/></div>
          <div className="parent-chart-frame parent-academic-chart">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={academicTrend} margin={{top:34,right:18,left:-4,bottom:0}} barCategoryGap="36%">
              <CartesianGrid vertical={false} strokeDasharray="3 7"/><XAxis dataKey="assessment" tickLine={false} axisLine={false}/><YAxis domain={[0,100]} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>[`${v} / 100`,'Purata markah']}/><Bar dataKey="average" fill="currentColor" radius={[9,9,2,2]} maxBarSize={88}><LabelList dataKey="average" position="top" formatter={(v:any)=>Number(v)>0?Number(v).toFixed(1):''} /></Bar></BarChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="parent-chart-card premium-parent-card">
          <div className="parent-section-head"><div><span>PBD · {latestPbd||'—'}</span><h2>Taburan Tahap Penguasaan</h2></div><BookOpenCheck size={21}/></div>
          <div className="parent-chart-frame compact">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={tpDistribution} margin={{top:32,right:8,left:-14,bottom:0}} barCategoryGap="24%"><CartesianGrid vertical={false} strokeDasharray="3 7"/><XAxis dataKey="tp" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>[v,'Mata pelajaran']}/><Bar dataKey="count" fill="currentColor" radius={[8,8,2,2]} maxBarSize={54}><LabelList dataKey="count" position="top" formatter={(v:any)=>Number(v)>0?String(v):''}/></Bar></BarChart></ResponsiveContainer>
          </div>
        </GlassCard>
      </section>

      <GlassCard className="parent-detail-card premium-parent-card">
        <div className="parent-section-head"><div><span>REKOD TERPERINCI</span><h2>Prestasi Akademik Mengikut Mata Pelajaran</h2></div></div>
        <div className="table-scroll parent-table-scroll"><table className="data-table parent-premium-table"><thead><tr><th>Mata Pelajaran</th>{academicAssessments.map(a=><th key={a.code}>{a.code}</th>)}</tr></thead><tbody>{academicSubjects.map(s=><tr key={s.code}><td><strong>{s.name}</strong></td>{academicAssessments.map(a=>{const r=report.academic.find(x=>(x.subject_code||x.subject)===s.code&&x.assessment===a.code);return <td key={a.code}>{r?<div className="parent-result-cell"><strong>{r.score??'—'}</strong><span className={`grade grade-${String(r.grade||'').toLowerCase()}`}>{r.grade||'—'}</span></div>:'—'}</td>})}</tr>)}</tbody></table></div>
      </GlassCard>

      <GlassCard className="parent-detail-card premium-parent-card">
        <div className="parent-section-head"><div><span>PBD</span><h2>Tahap Penguasaan Mengikut Mata Pelajaran</h2></div></div>
        <div className="table-scroll parent-table-scroll"><table className="data-table parent-premium-table"><thead><tr><th>Mata Pelajaran</th>{pbdAssessments.map(a=><th key={a.code}>{a.code}</th>)}</tr></thead><tbody>{pbdSubjects.map(s=><tr key={s.code}><td><strong>{s.name}</strong></td>{pbdAssessments.map(a=>{const r=report.pbd.find(x=>(x.subject_code||x.subject)===s.code&&x.assessment===a.code);return <td key={a.code}>{r?<span className={`tp-orb tp-${r.tp}`}>TP{r.tp}</span>:'—'}</td>})}</tr>)}</tbody></table></div>
      </GlassCard>
    </div>}
  </div>
}

function formatClass(value:string){return value.charAt(0)+value.slice(1).toLowerCase();}
