import { ArrowUpRight, Award, BarChart3, BookOpenCheck, Search, ShieldCheck, Sparkles, TrendingUp, UserRound } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  const interventionSubjects=latestRows.filter(r=>r.grade==='F').length;
  const latestPbdRows=report?.pbd.filter(r=>r.assessment===latestPbd)||[];
  const pbdMtm=latestPbdRows.filter(r=>r.tp>=3).length;
  const trendDelta=academicTrend.length>1?academicTrend[academicTrend.length-1].average-academicTrend[0].average:null;
  const initials=report?.student.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('')||'';

  return <div className={`parent-page ${report?'has-report':''}`}>
    {!report&&<>
      <PageHeader title="Semakan Ibu Bapa" />
      <section className="parent-lookup-stage">
        <div className="lookup-copy">
          <h1>Fahami pencapaian anak.<br/>Jejaki perkembangannya.</h1>
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
      <section className="parent-report-hero premium-parent-card">
        <button className="parent-new-search" onClick={()=>{setReport(null);setMykid('');setMessage('')}}><Search size={15}/> Semakan baharu</button>
        <div className="parent-profile-medallion" aria-hidden="true"><span>{initials}</span></div>
        <div className="parent-hero-copy">
          <div className="parent-student-overline">LAPORAN PRESTASI · {report.student.school_year}</div>
          <h1>{report.student.name}</h1>
          <div className="parent-identity-line">
            <span><small>ID Murid</small><strong>{report.student.student_id}</strong></span>
            <span><small>Kelas</small><strong>{report.student.year_level} {formatClass(report.student.class_name)}</strong></span>
            <span><small>Status</small><strong>Rekod Aktif</strong></span>
          </div>
        </div>
        <div className="parent-hero-seal"><ShieldCheck size={18}/><span>Data rasmi<br/><strong>sekolah</strong></span></div>
      </section>

      <section className="parent-kpi-rail">
        <div className="parent-kpi-card"><span className="parent-kpi-icon"><BarChart3 size={18}/></span><div><span>Purata {latestAcademic||'Akademik'}</span><strong>{averageLatest===null?'—':averageLatest.toFixed(1)}</strong><small>/ 100</small></div></div>
        <div className="parent-kpi-card"><span className="parent-kpi-icon"><TrendingUp size={18}/></span><div><span>Perubahan</span><strong>{trendDelta===null?'—':`${trendDelta>=0?'+':''}${trendDelta.toFixed(1)}`}</strong><small>{academicTrend.length>1?'sejak rekod awal':'belum ada perbandingan'}</small></div></div>
        <div className="parent-kpi-card"><span className="parent-kpi-icon"><Award size={18}/></span><div><span>Subjek MTM</span><strong>{mtmSubjects}</strong><small>{latestAcademic||'—'}</small></div></div>
        <div className="parent-kpi-card parent-kpi-attention"><span className="parent-kpi-icon"><Sparkles size={18}/></span><div><span>Perlu perhatian</span><strong>{interventionSubjects}</strong><small>Gred F</small></div></div>
      </section>

      <section className="parent-dashboard-grid">
        <GlassCard className="parent-chart-card parent-chart-wide premium-parent-card">
          <div className="parent-section-head"><div><span>AKADEMIK</span><h2>Perkembangan Prestasi</h2><p>Purata markah mengikut pusingan pentaksiran</p></div><ArrowUpRight size={22}/></div>
          <div className="parent-chart-frame parent-academic-chart">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={academicTrend} margin={{top:38,right:18,left:0,bottom:0}} barCategoryGap="34%">
              <CartesianGrid vertical={false} strokeDasharray="3 7"/><XAxis dataKey="assessment" tickLine={false} axisLine={false}/><YAxis domain={[0,100]} tickLine={false} axisLine={false}/><Tooltip cursor={{fill:'rgba(154,119,32,.05)'}} formatter={(v:any)=>[`${v} / 100`,'Purata markah']}/><Bar dataKey="average" radius={[10,10,3,3]} maxBarSize={92}>{academicTrend.map((d,i)=><Cell key={d.assessment} className={i===academicTrend.length-1?'parent-bar-current':'parent-bar-past'}/>) }<LabelList dataKey="average" position="top" formatter={(v:any)=>Number(v)>0?Number(v).toFixed(1):''} /></Bar></BarChart></ResponsiveContainer>
          </div>
          {trendDelta!==null&&<div className={`parent-trend-note ${trendDelta<0?'down':''}`}><TrendingUp size={18}/><strong>{trendDelta>=0?'+':''}{trendDelta.toFixed(1)}</strong><span>perubahan purata daripada rekod awal</span></div>}
        </GlassCard>

        <GlassCard className="parent-chart-card parent-pbd-feature premium-parent-card">
          <div className="parent-section-head"><div><span>PBD · {latestPbd||'—'}</span><h2>Taburan Tahap Penguasaan</h2><p>Bilangan mata pelajaran mengikut TP terkini</p></div><BookOpenCheck size={21}/></div>
          <div className="parent-chart-frame compact">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={tpDistribution} margin={{top:32,right:8,left:-8,bottom:0}} barCategoryGap="24%"><CartesianGrid vertical={false} strokeDasharray="3 7"/><XAxis dataKey="tp" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip cursor={{fill:'rgba(154,119,32,.05)'}} formatter={(v:any)=>[v,'Mata pelajaran']}/><Bar dataKey="count" radius={[8,8,2,2]} maxBarSize={58}>{tpDistribution.map((d,i)=><Cell key={d.tp} className={`parent-tp-bar parent-tp-bar-${i+1}`}/>) }<LabelList dataKey="count" position="top" formatter={(v:any)=>String(v)}/></Bar></BarChart></ResponsiveContainer>
          </div>
          <div className="parent-pbd-foot"><span><strong>{pbdMtm}</strong> subjek TP3–TP6</span><span><strong>{latestPbdRows.length-pbdMtm}</strong> subjek TP1–TP2</span></div>
        </GlassCard>
      </section>

      <GlassCard className="parent-detail-card premium-parent-card">
        <div className="parent-section-head"><div><span>REKOD TERPERINCI</span><h2>Prestasi Akademik Mengikut Mata Pelajaran</h2><p>Perbandingan markah dan gred bagi setiap pusingan</p></div><UserRound size={20}/></div>
        <div className="table-scroll parent-table-scroll"><table className="data-table parent-premium-table"><thead><tr><th>Mata Pelajaran</th>{academicAssessments.map(a=><th key={a.code}>{a.code}</th>)}</tr></thead><tbody>{academicSubjects.map(s=><tr key={s.code}><td><strong>{s.name}</strong></td>{academicAssessments.map(a=>{const r=report.academic.find(x=>(x.subject_code||x.subject)===s.code&&x.assessment===a.code);return <td key={a.code}>{r?<div className="parent-result-cell"><strong>{r.score??'—'}</strong><span className={`grade grade-${String(r.grade||'').toLowerCase()}`}>{r.grade||'—'}</span></div>:'—'}</td>})}</tr>)}</tbody></table></div>
      </GlassCard>

      <GlassCard className="parent-detail-card premium-parent-card">
        <div className="parent-section-head"><div><span>PBD</span><h2>Tahap Penguasaan Mengikut Mata Pelajaran</h2><p>Perbandingan tahap penguasaan bagi setiap pusingan</p></div></div>
        <div className="table-scroll parent-table-scroll"><table className="data-table parent-premium-table"><thead><tr><th>Mata Pelajaran</th>{pbdAssessments.map(a=><th key={a.code}>{a.code}</th>)}</tr></thead><tbody>{pbdSubjects.map(s=><tr key={s.code}><td><strong>{s.name}</strong></td>{pbdAssessments.map(a=>{const r=report.pbd.find(x=>(x.subject_code||x.subject)===s.code&&x.assessment===a.code);return <td key={a.code}>{r?<span className={`tp-orb tp-${r.tp}`}>TP{r.tp}</span>:'—'}</td>})}</tr>)}</tbody></table></div>
      </GlassCard>
    </div>}
  </div>
}

function formatClass(value:string){return value.charAt(0)+value.slice(1).toLowerCase();}
