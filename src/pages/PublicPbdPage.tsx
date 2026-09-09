import { AlertTriangle, Target, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DistributionBars } from '../components/DistributionBars';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { TP_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';

interface SummaryRow { subject_code:string;subject_name:string;total:number;TP1:number;TP2:number;TP3:number;TP4:number;TP5:number;TP6:number;mtm_pct:number;intervention_pct:number }
interface PublicAssessment { code:string;kind:string;title:string;sequence_no:number|null }

export function PublicPbdPage() {
  const [years,setYears]=useState<number[]>([]); const [year,setYear]=useState(new Date().getFullYear());
  const [assessments,setAssessments]=useState<PublicAssessment[]>([]); const [assessment,setAssessment]=useState('');
  const [classes,setClasses]=useState<string[]>([]); const [className,setClassName]=useState('ALL');
  const [rows,setRows]=useState<SummaryRow[]>([]); const [error,setError]=useState('');

  useEffect(()=>{supabase.rpc('v2_public_years').then(({data})=>{const ys=(data||[]).map((x:any)=>Number(x.school_year));setYears(ys);if(ys[0])setYear(ys[0]);});},[]);
  useEffect(()=>{if(!year)return;supabase.rpc('v2_public_classes',{p_year:year}).then(({data})=>{setClasses((data||[]).map((x:any)=>x.class_name));setClassName('ALL');});supabase.rpc('v2_public_assessments',{p_year:year}).then(({data,error})=>{if(error){setError(error.message);return;}const pbd=((data||[]) as PublicAssessment[]).filter(x=>x.kind==='PBD');setAssessments(pbd);setAssessment(pbd[0]?.code||'');});},[year]);
  useEffect(()=>{if(assessment)void load();},[year,assessment,className]);
  async function load(){const {data,error}=await supabase.rpc('v2_public_pbd_summary',{p_year:year,p_assessment_code:assessment,p_class_name:className==='ALL'?null:className});if(error){setError(error.message);setRows([]);return;}setError('');setRows((data||[]) as SummaryRow[])}
  const total=useMemo(()=>rows.reduce((a,r)=>a+Number(r.total||0),0),[rows]); const intervention=useMemo(()=>rows.reduce((a,r)=>a+Number(r.TP1||0)+Number(r.TP2||0),0),[rows]);

  return <div className="public-report"><PageHeader eyebrow="LAPORAN UMUM" title="Pelaporan PBD" description="Rumusan TP tanpa maklumat peribadi murid."/>
    <GlassCard className="filter-card"><div className="filter-grid three"><label>Tahun<select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Kelas<select value={className} onChange={e=>setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label><label>Pusingan PBD<select value={assessment} onChange={e=>setAssessment(e.target.value)}>{assessments.map(a=><option key={a.code} value={a.code}>{a.title||a.code}</option>)}</select></label></div></GlassCard>
    {error&&<div className="notice">{error}</div>}
    <div className="stats-grid three"><StatCard icon={Users} label="Rekod" value={total}/><StatCard icon={Target} label="MTM" value={total?`${((total-intervention)/total*100).toFixed(1)}%`:'0.0%'} tone="green"/><StatCard icon={AlertTriangle} label="Intervensi" value={intervention} hint="TP1–TP2" tone="red"/></div>
    <div className="subject-analysis-list">{rows.map(r=>{const items=TP_ORDER.map(tp=>({label:tp,count:Number(r[tp]||0),pct:r.total?Number(r[tp]||0)/r.total*100:0}));return <GlassCard className="subject-card" key={r.subject_code}><div className="subject-card-head"><div><div className="eyebrow">PBD</div><h2>{r.subject_name}</h2></div><div className="metric-pair"><span>MTM<strong>{Number(r.mtm_pct||0).toFixed(1)}%</strong></span><span>Intervensi<strong>{Number(r.intervention_pct||0).toFixed(1)}%</strong></span></div></div><div className="subject-card-body single"><DistributionBars items={items}/></div></GlassCard>})}</div>
  </div>;
}
