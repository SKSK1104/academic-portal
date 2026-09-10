import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { createWorker, PSM } from 'tesseract.js';
import type { ParsedPdfDocument } from '../types';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const SUBJECTS = ['BM','BI','MM','SAINS','SEJ','PAI','PM','BIN','RBT','PSV','PMZ','PJPK'];
const CLASS_ALIASES: Array<[RegExp,string]> = [
  [/\bCAHAYA\b/i,'CAHAYA'],
  [/\bSINARAN\b/i,'SINARAN'],
  [/\bKERLIPAN\b/i,'KERLIPAN'],
  [/\b(?:BISTARI|BESTARI)\b/i,'BISTARI'],
  [/\bBIJAKSANA\b/i,'BIJAKSANA'],
  [/\bGEMILANG\b/i,'GEMILANG']
];

type Word = { text:string; x0:number; y0:number; x1:number; y1:number; cx:number; cy:number };
type Page = { width:number; height:number; text:string; words:Word[] };

function clean(s:string){ return s.replace(/\s+/g,' ').trim(); }
function up(s:string){ return clean(s).toUpperCase(); }
function canonicalClassName(value:string){
  const normalized=up(value).replace(/[^A-Z0-9 ]/g,' ');
  for(const [pattern,name] of CLASS_ALIASES) if(pattern.test(normalized)) return name;
  return normalized
    .replace(/^KELAS\s*:?\s*/,'')
    .replace(/^TAHUN\s+(?:SATU|DUA|TIGA|EMPAT|LIMA|ENAM|[1-6])\s*/,'')
    .replace(/^[1-6]\s+/,'')
    .replace(/BESTARI/g,'BISTARI')
    .replace(/\s+/g,' ')
    .trim();
}

async function readPages(file:File, progress?:(s:string)=>void):Promise<Page[]> {
  const pdf = await getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const worker = await createWorker('eng',1,{logger:m=>{ if(m.status==='recognizing text') progress?.(`OCR ${Math.round(m.progress*100)}%`); }});
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1'});
  const out:Page[]=[];
  try {
    for(let n=1;n<=pdf.numPages;n++){
      progress?.(`Membaca halaman ${n}/${pdf.numPages}...`);
      const page=await pdf.getPage(n); const viewport=page.getViewport({scale:2});
      const canvas=document.createElement('canvas'); canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx) throw new Error('Kanvas PDF tidak tersedia.');
      await page.render({canvas,canvasContext:ctx,viewport}).promise;
      const r=await worker.recognize(canvas,{}, {text:true,blocks:true});
      const words:Word[]=[];
      for(const b of r.data.blocks||[]) for(const p of b.paragraphs||[]) for(const l of p.lines||[]) for(const w of l.words||[]){
        const text=clean(w.text||''); if(!text) continue;
        words.push({text,x0:w.bbox.x0,y0:w.bbox.y0,x1:w.bbox.x1,y1:w.bbox.y1,cx:(w.bbox.x0+w.bbox.x1)/2,cy:(w.bbox.y0+w.bbox.y1)/2});
      }
      out.push({width:canvas.width,height:canvas.height,text:r.data.text||'',words});
    }
  } finally { await worker.terminate(); }
  return out;
}

function metadata(text:string){
  const t=up(text);
  const year=(t.match(/(?:TAHUN|SESI(?: AKADEMIK)?)\s+(20\d{2})/)||t.match(/\b(20\d{2})\b/))?.[1];
  const yearWords:[RegExp,number][]=[[/TAHUN SATU/,1],[/TAHUN DUA/,2],[/TAHUN TIGA/,3],[/TAHUN EMPAT/,4],[/TAHUN LIMA/,5],[/TAHUN ENAM/,6]];
  let level:number|null=null;
  for(const [p,n] of yearWords) if(p.test(t)){level=n;break;}
  if(!level){const m=t.match(/TAHUN\s+([1-6])\b/);if(m)level=Number(m[1]);}

  let className:string|null=null;
  for(const [pattern,name] of CLASS_ALIASES){ if(pattern.test(t)){ className=name; break; } }
  if(!className){
    const cm=t.match(/KELAS\s*:?\s*(?:TAHUN\s*)?([1-6]?\s*[A-Z][A-Z ]{2,30})/)||t.match(/\b([1-6]\s+[A-Z]{3,20})\b/);
    if(cm) className=canonicalClassName(cm[1]);
  }

  const am=t.match(/AKTIVITI\s*:?\s*([^\n]{5,80})/)||t.match(/(UJIAN AKHIR SESI AKADEMIK)/)||t.match(/(PENTAKSIRAN PERTENGAHAN SESI AKADEMIK)/);
  return {school_year:year?Number(year):null,year_level:level,class_name:className,activity:am?clean(am[1]):null};
}

function typeOf(text:string,hint:'AUTO'|'UASA'|'PBD'):ParsedPdfDocument['doc_type']{
  const t=up(text); if(hint==='UASA')return'UASA_INDIVIDUAL';
  if(hint==='PBD')return /TP1[\s\S]{0,80}TP2[\s\S]{0,80}TP3/.test(t)&&!/MYKID/.test(t)?'PBD_SUMMARY':'PBD_INDIVIDUAL';
  if(/UJIAN AKHIR SESI AKADEMIK|\bUASA\b/.test(t))return'UASA_INDIVIDUAL';
  if(/TP1[\s\S]{0,80}TP2[\s\S]{0,80}TP3/.test(t))return /MYKID/.test(t)?'PBD_INDIVIDUAL':'PBD_SUMMARY';
  return'UNKNOWN';
}

function headerY(p:Page){ return p.words.find(w=>/MYKID|PENGENALAN/i.test(w.text))?.cy||p.words.find(w=>/^NAMA$/i.test(w.text))?.cy||p.height*.28; }
function centers(p:Page,y:number){
  const near=p.words.filter(w=>Math.abs(w.cy-y)<p.height*.035);
  const out:Record<string,number>={};
  for(const c of SUBJECTS){
    const w=near.find(x=>up(x.text).replace(/[^A-Z]/g,'')===c);
    if(w) out[c]=w.cx;
  }
  return out;
}

function individual(pages:Page[],kind:'UASA_INDIVIDUAL'|'PBD_INDIVIDUAL'){
  const rows:NonNullable<ParsedPdfDocument['rows']>=[]; const warnings:string[]=[];
  for(const p of pages){
    const hy=headerY(p),cs=centers(p,hy),detectedSubjects=Object.keys(cs);
    if(!detectedSubjects.length){warnings.push('Tajuk mata pelajaran tidak dapat dibaca pada satu halaman; halaman itu tidak diandaikan.');continue;}
    const ids=p.words.filter(w=>/^\d{11,13}$/.test(w.text.replace(/\D/g,''))&&w.cy>hy).sort((a,b)=>a.cy-b.cy);if(!ids.length)continue;
    const gaps=ids.slice(1).map((w,i)=>w.cy-ids[i].cy).sort((a,b)=>a-b);const half=Math.max(16,(gaps[Math.floor(gaps.length/2)]||p.height*.05)*.42);
    for(const a of ids){
      const band=p.words.filter(w=>Math.abs(w.cy-a.cy)<=half);
      const name=clean(band.filter(w=>w.x0>p.width*.11&&w.cx<p.width*.33).sort((x,y)=>x.y0-y.y0||x.x0-y.x0).map(w=>w.text).join(' '));
      const gender=band.find(w=>w.cx>p.width*.48&&w.cx<p.width*.54&&/^[LP]$/i.test(w.text))?.text?.toUpperCase()||null;
      const values:Record<string,string|number|null>={};
      for(const c of detectedSubjects){
        const x=cs[c];
        const token=band.filter(w=>Math.abs(w.cx-x)<p.width*.018).sort((m,n)=>Math.abs(m.cx-x)-Math.abs(n.cx-x))[0]?.text?.toUpperCase().replace(/[^A-Z0-9]/g,'')||'';
        if(kind==='UASA_INDIVIDUAL') values[c]=/^[A-F]$/.test(token)?token:null;
        else {const m=token.match(/TP?([1-6])/);values[c]=m?`TP${m[1]}`:null;}
      }
      if(!name)warnings.push('Nama tidak jelas untuk satu rekod.');
      rows.push({student_name:name||'REKOD TANPA NAMA',mykid:a.text.replace(/\D/g,''),gender,values});
    }
  }
  return{rows,warnings};
}

function summary(pages:Page[]){
  const out:NonNullable<ParsedPdfDocument['summary']>=[];const warnings:string[]=[];
  for(const p of pages){const hy=headerY(p);const tps=Array.from({length:6},(_,i)=>p.words.find(w=>up(w.text).replace(/[^A-Z0-9]/g,'')===`TP${i+1}`&&Math.abs(w.cy-hy)<p.height*.05)?.cx||p.width*(.68+(i+1)*.035));
    const groups=new Map<number,Word[]>();for(const w of p.words.filter(w=>w.cy>hy+10)){const k=Math.round(w.cy/12)*12;groups.set(k,[...(groups.get(k)||[]),w]);}
    for(const band of [...groups.values()].sort((a,b)=>a[0].cy-b[0].cy)){const label=clean(band.filter(w=>w.cx<p.width*.66&&w.cx>p.width*.10).sort((a,b)=>a.x0-b.x0).map(w=>w.text).join(' '));if(!/BAHASA|MATEMATIK|SAINS|SEJARAH|PENDIDIKAN|REKA BENTUK|MUZIK|IBAN/i.test(label))continue;const item:any={subject_label:label};let total=0;tps.forEach((x,i)=>{const s=band.filter(w=>Math.abs(w.cx-x)<p.width*.025).sort((a,b)=>Math.abs(a.cx-x)-Math.abs(b.cx-x))[0]?.text||'';const n=Number(s.replace(/\D/g,''));if(Number.isFinite(n)&&n>=0){item[`TP${i+1}`]=n;total+=n;}});item.total=total;out.push(item);}
  } if(!out.length)warnings.push('Ringkasan TP tidak dapat dibaca dengan yakin.');return{summary:out,warnings};
}

export async function parsePdfLocally(file:File,hint:'AUTO'|'UASA'|'PBD'='AUTO',progress?:(s:string)=>void):Promise<ParsedPdfDocument>{
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Fail mestilah PDF.');
  const pages=await readPages(file,progress);const text=pages.map(p=>p.text).join('\n');const doc_type=typeOf(text,hint);
  if(doc_type==='UNKNOWN')throw new Error('Jenis laporan tidak dapat dikenal pasti sebagai UASA atau PBD.');
  const meta=metadata(text);
  const base:ParsedPdfDocument={doc_type,school_name:/SIMPANG\s+KUDA/i.test(text)?'SEKOLAH KEBANGSAAN SIMPANG KUDA':null,...meta,subjects:SUBJECTS.map(c=>({label:c,code_hint:c})),warnings:[]};
  if(doc_type==='PBD_SUMMARY'){const r=summary(pages);base.summary=r.summary;base.warnings=r.warnings;}
  else{const r=individual(pages,doc_type);base.rows=r.rows;base.warnings=r.warnings;if(!r.rows.length)throw new Error('Tiada baris murid dapat dibaca daripada PDF.');}
  return base;
}
