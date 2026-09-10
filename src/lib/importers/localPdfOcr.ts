import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
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

function makeWordsFromTextItem(item:any, viewport:any): Word[] {
  const raw=String(item?.str || '');
  if(!raw.trim()) return [];
  const transform=item?.transform || [1,0,0,1,0,0];
  const [vx,vy]=viewport.convertToViewportPoint(Number(transform[4]||0),Number(transform[5]||0));
  const scale=Number(viewport.scale || 1);
  const width=Math.max(1,Number(item?.width || raw.length*4)*scale);
  const height=Math.max(8,Math.abs(Number(item?.height || transform[3] || 8))*scale);
  const out:Word[]=[];
  const re=/\S+/g;
  let match:RegExpExecArray|null;
  while((match=re.exec(raw))){
    const token=clean(match[0]);
    if(!token) continue;
    const start=match.index;
    const end=start+match[0].length;
    const x0=vx+width*(start/Math.max(1,raw.length));
    const x1=vx+width*(end/Math.max(1,raw.length));
    const y1=vy;
    const y0=vy-height;
    out.push({text:token,x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2});
  }
  return out;
}

function pageTextFromWords(words:Word[]){
  const sorted=[...words].sort((a,b)=>a.cy-b.cy || a.x0-b.x0);
  const lines:Word[][]=[];
  for(const w of sorted){
    const last=lines[lines.length-1];
    if(!last || Math.abs(last[0].cy-w.cy)>7) lines.push([w]);
    else last.push(w);
  }
  return lines.map(line=>line.sort((a,b)=>a.x0-b.x0).map(w=>w.text).join(' ')).join('\n');
}

async function readPages(file:File, progress?:(s:string)=>void):Promise<Page[]> {
  const pdf=await getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const out:Page[]=[];
  for(let n=1;n<=pdf.numPages;n++){
    progress?.(`Membaca teks PDF ${n}/${pdf.numPages}...`);
    const page=await pdf.getPage(n);
    const viewport=page.getViewport({scale:2});
    const content=await page.getTextContent();
    const words:Word[]=[];
    for(const item of content.items as any[]) words.push(...makeWordsFromTextItem(item,viewport));
    if(words.length<10) throw new Error(`Halaman ${n} tidak mempunyai lapisan teks yang mencukupi.`);
    out.push({width:viewport.width,height:viewport.height,text:pageTextFromWords(words),words});
  }
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
  if(hint==='PBD')return /TP1[\s\S]{0,120}TP2[\s\S]{0,120}TP3/.test(t)&&!/MYKID/.test(t)?'PBD_SUMMARY':'PBD_INDIVIDUAL';
  if(/UJIAN AKHIR SESI AKADEMIK|\bUASA\b/.test(t))return'UASA_INDIVIDUAL';
  if(/TP1[\s\S]{0,120}TP2[\s\S]{0,120}TP3/.test(t))return /MYKID/.test(t)?'PBD_INDIVIDUAL':'PBD_SUMMARY';
  return'UNKNOWN';
}

function headerY(p:Page){
  const marker=p.words.find(w=>/MYKID|PENGENALAN/i.test(w.text));
  if(marker) return marker.cy;
  const nama=p.words.find(w=>/^NAMA$/i.test(w.text));
  return nama?.cy||p.height*.28;
}
function centers(p:Page,y:number){
  const near=p.words.filter(w=>Math.abs(w.cy-y)<p.height*.045);
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
    const hy=headerY(p),cs=centers(p,hy),detectedSubjects=Object.keys(cs).sort((a,b)=>cs[a]-cs[b]);
    if(!detectedSubjects.length){warnings.push('Tajuk mata pelajaran tidak dapat dibaca pada satu halaman; halaman itu tidak diandaikan.');continue;}
    const ids=p.words.filter(w=>/^\d{11,13}$/.test(w.text.replace(/\D/g,''))&&w.cy>hy).sort((a,b)=>a.cy-b.cy);
    if(!ids.length)continue;
    const gaps=ids.slice(1).map((w,i)=>w.cy-ids[i].cy).filter(g=>g>0).sort((a,b)=>a-b);
    const typical=gaps[Math.floor(gaps.length/2)]||p.height*.045;
    const half=Math.max(14,Math.min(typical*.46,p.height*.032));
    for(const a of ids){
      const band=p.words.filter(w=>Math.abs(w.cy-a.cy)<=half);
      const genderWord=band.filter(w=>w.x0>a.x1 && /^[LP]$/i.test(w.text)).sort((m,n)=>m.x0-n.x0)[0];
      const gender=genderWord?.text?.toUpperCase()||null;
      const values:Record<string,string|number|null>={};
      for(const c of detectedSubjects){
        const x=cs[c];
        const tokens=band.filter(w=>Math.abs(w.cx-x)<p.width*.022).sort((m,n)=>Math.abs(m.cx-x)-Math.abs(n.cx-x));
        const token=up(tokens[0]?.text||'').replace(/[^A-Z0-9]/g,'');
        if(kind==='UASA_INDIVIDUAL') values[c]=/^[A-F]$/.test(token)?token:null;
        else {const m=token.match(/TP?([1-6])/);values[c]=m?`TP${m[1]}`:null;}
      }
      const nameWords=band.filter(w=>w.x1<a.x0-p.width*.006 && !/^\d+$/.test(w.text) && !/^(BIL|NAMA)$/i.test(w.text));
      const name=clean(nameWords.sort((x,y)=>x.x0-y.x0).map(w=>w.text).join(' '));
      rows.push({student_name:name||'REKOD TANPA NAMA',mykid:a.text.replace(/\D/g,''),gender,values});
    }
  }
  const unique=new Map<string,NonNullable<ParsedPdfDocument['rows']>[number]>();
  for(const row of rows) if(row.mykid) unique.set(row.mykid,row);
  return{rows:[...unique.values()],warnings};
}

function summary(pages:Page[]){
  const out:NonNullable<ParsedPdfDocument['summary']>=[];const warnings:string[]=[];
  for(const p of pages){
    const hy=headerY(p);
    const tps=Array.from({length:6},(_,i)=>p.words.find(w=>up(w.text).replace(/[^A-Z0-9]/g,'')===`TP${i+1}`&&Math.abs(w.cy-hy)<p.height*.06)?.cx||null);
    if(tps.some(x=>x===null)){warnings.push('Sebahagian lajur TP ringkasan tidak dapat dikenal pasti.');continue;}
    const rowWords=p.words.filter(w=>w.cy>hy+8);
    const lines:Word[][]=[];
    for(const w of rowWords.sort((a,b)=>a.cy-b.cy||a.x0-b.x0)){
      const last=lines[lines.length-1];
      if(!last||Math.abs(last[0].cy-w.cy)>7) lines.push([w]); else last.push(w);
    }
    for(const band of lines){
      const label=clean(band.filter(w=>w.cx<(tps[0] as number)-p.width*.02).sort((a,b)=>a.x0-b.x0).map(w=>w.text).join(' '));
      if(!/BAHASA|MATEMATIK|SAINS|SEJARAH|PENDIDIKAN|REKA BENTUK|MUZIK|IBAN/i.test(label))continue;
      const item:any={subject_label:label};let total=0;
      tps.forEach((x,i)=>{
        const token=band.filter(w=>Math.abs(w.cx-(x as number))<p.width*.022).sort((a,b)=>Math.abs(a.cx-(x as number))-Math.abs(b.cx-(x as number)))[0]?.text||'';
        const digits=token.replace(/\D/g,'');
        const n=digits===''?0:Number(digits);
        item[`TP${i+1}`]=Number.isFinite(n)?n:0;
        total+=item[`TP${i+1}`];
      });
      item.total=total;out.push(item);
    }
  }
  if(!out.length)warnings.push('Ringkasan TP tidak dapat dibaca dengan yakin.');
  return{summary:out,warnings};
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
