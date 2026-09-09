-- Portal Akademik 2.0 — isolated from Portal 1.0 tables.
create extension if not exists pgcrypto;

create table if not exists public.v2_students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  name text not null,
  mykid text not null unique,
  dob_text text,
  gender text,
  ethnicity text,
  religion text,
  oku_status text,
  oku_category text,
  oku_subcategory text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.v2_students(id) on delete cascade,
  school_year int not null check (school_year between 2020 and 2100),
  year_level smallint not null check (year_level between 1 and 6),
  class_name text not null,
  class_teacher text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, school_year)
);
create index if not exists v2_enrolments_year_class_idx on public.v2_enrolments(school_year,class_name);

create table if not exists public.v2_subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ms text not null,
  name_en text
);

create table if not exists public.v2_subject_offerings (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.v2_subjects(id) on delete cascade,
  year_level smallint not null check (year_level between 1 and 6),
  ar_enabled boolean not null default false,
  uasa_enabled boolean not null default true,
  pbd_enabled boolean not null default true,
  unique(subject_id,year_level)
);

create table if not exists public.v2_assessments (
  id uuid primary key default gen_random_uuid(),
  school_year int not null,
  kind text not null check (kind in ('AR','UASA','PBD')),
  code text not null,
  sequence_no int,
  title text,
  period_label text,
  source_kind text not null default 'manual' check (source_kind in ('manual','pdf','xlsx')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(school_year,code)
);
create index if not exists v2_assessments_year_kind_idx on public.v2_assessments(school_year,kind);

create table if not exists public.v2_academic_benchmarks (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.v2_enrolments(id) on delete cascade,
  subject_id uuid not null references public.v2_subjects(id) on delete cascade,
  tov numeric(5,2) check (tov is null or (tov >= 0 and tov <= 100)),
  etr numeric(5,2) check (etr is null or (etr >= 0 and etr <= 100)),
  updated_at timestamptz not null default now(),
  unique(enrolment_id,subject_id)
);

create table if not exists public.v2_imports (
  id uuid primary key default gen_random_uuid(),
  school_year int,
  import_type text not null,
  file_name text not null,
  storage_path text,
  status text not null default 'preview' check(status in ('preview','confirmed','failed','reverted')),
  detected_metadata jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.v2_academic_marks (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.v2_assessments(id) on delete cascade,
  enrolment_id uuid not null references public.v2_enrolments(id) on delete cascade,
  subject_id uuid not null references public.v2_subjects(id) on delete cascade,
  score numeric(5,2) check (score is null or (score >= 0 and score <= 100)),
  grade text check (grade is null or grade in ('A','B','C','D','E','F','TH')),
  source text not null default 'manual' check(source in ('manual','xlsx','pdf')),
  source_import_id uuid references public.v2_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(assessment_id,enrolment_id,subject_id)
);
create index if not exists v2_academic_marks_assessment_idx on public.v2_academic_marks(assessment_id,subject_id);

create table if not exists public.v2_pbd_records (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.v2_assessments(id) on delete cascade,
  enrolment_id uuid not null references public.v2_enrolments(id) on delete cascade,
  subject_id uuid not null references public.v2_subjects(id) on delete cascade,
  tp smallint not null check (tp between 1 and 6),
  source_import_id uuid references public.v2_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(assessment_id,enrolment_id,subject_id)
);
create index if not exists v2_pbd_records_assessment_idx on public.v2_pbd_records(assessment_id,subject_id);

create table if not exists public.v2_intelligence_profiles (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.v2_enrolments(id) on delete cascade,
  school_year int not null,
  profile jsonb not null default '{}'::jsonb,
  source_import_id uuid references public.v2_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(enrolment_id,school_year)
);

-- Subject catalogue. AR offerings are deliberately separated from UASA/PBD.
insert into public.v2_subjects(code,name_ms,name_en) values
('BM','BAHASA MELAYU','Malay Language'),
('BI','BAHASA INGGERIS','English'),
('MAT','MATEMATIK','Mathematics'),
('SN','SAINS','Science'),
('SEJ','SEJARAH','History'),
('PI','PENDIDIKAN ISLAM','Islamic Education'),
('PM','PENDIDIKAN MORAL','Moral Education'),
('BI_IBAN','BAHASA IBAN','Iban Language'),
('RBT','REKA BENTUK DAN TEKNOLOGI','Design and Technology'),
('PSV','PENDIDIKAN SENI VISUAL','Visual Arts'),
('MUZIK','PENDIDIKAN MUZIK','Music Education'),
('PJPK','PENDIDIKAN JASMANI DAN PENDIDIKAN KESIHATAN','Physical and Health Education')
on conflict(code) do update set name_ms=excluded.name_ms,name_en=excluded.name_en;

insert into public.v2_subject_offerings(subject_id,year_level,ar_enabled,uasa_enabled,pbd_enabled)
select s.id,y,
  case when s.code in ('BM','BI','MAT','SN') then true when s.code='SEJ' and y>=4 then true else false end,
  case when s.code in ('SEJ','RBT') and y<4 then false else true end,
  case when s.code in ('SEJ','RBT') and y<4 then false else true end
from public.v2_subjects s cross join generate_series(1,6) y
on conflict(subject_id,year_level) do update set
 ar_enabled=excluded.ar_enabled,uasa_enabled=excluded.uasa_enabled,pbd_enabled=excluded.pbd_enabled;

-- RLS: detailed student information is authenticated-only.
alter table public.v2_students enable row level security;
alter table public.v2_enrolments enable row level security;
alter table public.v2_subjects enable row level security;
alter table public.v2_subject_offerings enable row level security;
alter table public.v2_assessments enable row level security;
alter table public.v2_academic_benchmarks enable row level security;
alter table public.v2_academic_marks enable row level security;
alter table public.v2_pbd_records enable row level security;
alter table public.v2_imports enable row level security;
alter table public.v2_intelligence_profiles enable row level security;

do $$
declare t text;
begin
  foreach t in array array['v2_students','v2_enrolments','v2_subjects','v2_subject_offerings','v2_assessments','v2_academic_benchmarks','v2_academic_marks','v2_pbd_records','v2_imports','v2_intelligence_profiles'] loop
    execute format('drop policy if exists teacher_all on public.%I',t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (true) with check (true)',t);
  end loop;
end $$;

create or replace function public.v2_public_academic_summary(p_year int,p_assessment_code text,p_class_name text default null)
returns table(subject_code text, subject_name text, total bigint, attended bigint,"A" bigint,"B" bigint,"C" bigint,"D" bigint,"E" bigint,"F" bigint,"TH" bigint,mtm_pct numeric, intervention_pct numeric)
language sql stable security definer set search_path=public as $$
  select s.code,s.name_ms,count(*) as total,count(*) filter(where coalesce(m.grade,'TH') <> 'TH') as attended,
    count(*) filter(where m.grade='A'),count(*) filter(where m.grade='B'),count(*) filter(where m.grade='C'),count(*) filter(where m.grade='D'),count(*) filter(where m.grade='E'),count(*) filter(where m.grade='F'),count(*) filter(where coalesce(m.grade,'TH')='TH'),
    round(100.0 * count(*) filter(where m.grade in ('A','B','C','D','E')) / nullif(count(*) filter(where coalesce(m.grade,'TH')<>'TH'),0),1),
    round(100.0 * count(*) filter(where m.grade='F') / nullif(count(*) filter(where coalesce(m.grade,'TH')<>'TH'),0),1)
  from v2_academic_marks m join v2_assessments a on a.id=m.assessment_id join v2_subjects s on s.id=m.subject_id join v2_enrolments e on e.id=m.enrolment_id
  where a.school_year=p_year and upper(a.code)=upper(p_assessment_code) and (p_class_name is null or e.class_name=p_class_name)
  group by s.code,s.name_ms order by s.name_ms;
$$;

create or replace function public.v2_public_pbd_summary(p_year int,p_assessment_code text,p_class_name text default null)
returns table(subject_code text,subject_name text,total bigint,"TP1" bigint,"TP2" bigint,"TP3" bigint,"TP4" bigint,"TP5" bigint,"TP6" bigint,mtm_pct numeric,intervention_pct numeric)
language sql stable security definer set search_path=public as $$
  select s.code,s.name_ms,count(*),count(*) filter(where r.tp=1),count(*) filter(where r.tp=2),count(*) filter(where r.tp=3),count(*) filter(where r.tp=4),count(*) filter(where r.tp=5),count(*) filter(where r.tp=6),
    round(100.0*count(*) filter(where r.tp>=3)/nullif(count(*),0),1),round(100.0*count(*) filter(where r.tp<3)/nullif(count(*),0),1)
  from v2_pbd_records r join v2_assessments a on a.id=r.assessment_id join v2_subjects s on s.id=r.subject_id join v2_enrolments e on e.id=r.enrolment_id
  where a.school_year=p_year and upper(a.code)=upper(p_assessment_code) and (p_class_name is null or e.class_name=p_class_name)
  group by s.code,s.name_ms order by s.name_ms;
$$;

grant execute on function public.v2_public_academic_summary(int,text,text) to anon,authenticated;
grant execute on function public.v2_public_pbd_summary(int,text,text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assessment-imports','assessment-imports',false,10485760,array['application/pdf']) on conflict(id) do nothing;

drop policy if exists v2_import_upload on storage.objects;
create policy v2_import_upload on storage.objects for insert to authenticated with check(bucket_id='assessment-imports');
drop policy if exists v2_import_read on storage.objects;
create policy v2_import_read on storage.objects for select to authenticated using(bucket_id='assessment-imports');

create or replace function public.v2_public_years()
returns table(school_year int)
language sql stable security definer set search_path=public as $$
  select distinct a.school_year from v2_assessments a where a.is_active=true order by a.school_year desc;
$$;

create or replace function public.v2_public_assessments(p_year int)
returns table(code text,kind text,title text,sequence_no int)
language sql stable security definer set search_path=public as $$
  select a.code,a.kind,coalesce(a.title,a.code),a.sequence_no from v2_assessments a where a.school_year=p_year and a.is_active=true order by case a.kind when 'AR' then 1 when 'UASA' then 2 else 3 end, coalesce(a.sequence_no,999),a.code;
$$;

grant execute on function public.v2_public_years() to anon,authenticated;
grant execute on function public.v2_public_assessments(int) to anon,authenticated;

create table if not exists public.v2_parent_lookup_rate (
  ip_hash text not null,
  window_start timestamptz not null,
  attempts int not null default 1,
  primary key(ip_hash,window_start)
);
alter table public.v2_parent_lookup_rate enable row level security;

create or replace function public.v2_take_parent_lookup_slot(p_hash text)
returns boolean
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  insert into v2_parent_lookup_rate(ip_hash,window_start,attempts) values(p_hash,date_trunc('minute',now()),1)
  on conflict(ip_hash,window_start) do update set attempts=v2_parent_lookup_rate.attempts+1 returning attempts into n;
  return n <= 10;
end $$;
revoke all on function public.v2_take_parent_lookup_slot(text) from public,anon,authenticated;
grant execute on function public.v2_take_parent_lookup_slot(text) to service_role;

create or replace function public.v2_public_classes(p_year int)
returns table(class_name text,year_level smallint)
language sql stable security definer set search_path=public as $$
  select distinct e.class_name,e.year_level from v2_enrolments e where e.school_year=p_year order by e.year_level,e.class_name;
$$;
grant execute on function public.v2_public_classes(int) to anon,authenticated;
