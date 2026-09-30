-- Public Pentaksiran Psikometrik: class-level totals and averages only.
-- Returns no names, no MyKid, no individual scores. Read-only.

create or replace function public.v2_public_psychometric_years()
returns table(school_year int)
language sql stable security definer set search_path=public as $$
  select distinct p.school_year from public.v2_intelligence_profiles p order by 1 desc
$$;

create or replace function public.v2_public_psychometric_summary(p_year int)
returns table(year_level int, class_name text, format text, pupils int, summary jsonb)
language sql stable security definer set search_path=public as $$
with cls as (
  select (profile->>'year_level')::int yl, profile->>'class_name' cn, profile->>'format' fmt, profile
  from public.v2_intelligence_profiles where school_year = p_year
),
mi as (
  select c.yl, c.cn, s.key code,
    round(avg(s.value::numeric))::int avg,
    count(*) filter (where c.profile->'dominant' ? s.key)::int dom,
    count(*) filter (where s.value::numeric >= case when c.fmt='T6_APTITUD' then 80 else 75 end)::int tinggi,
    count(*) filter (where s.value::numeric >= 50 and s.value::numeric < case when c.fmt='T6_APTITUD' then 80 else 75 end)::int sederhana,
    count(*) filter (where s.value::numeric < 50)::int rendah
  from cls c, jsonb_each_text(c.profile->'scores') s
  where c.fmt in ('T5_IKEP','T6_APTITUD')
  group by 1,2,3
),
mi_class as (
  select c.yl, c.cn,
    count(*) filter (where jsonb_array_length(coalesce(c.profile->'dominant','[]'::jsonb)) > 1)::int tied,
    count(*) filter (where (c.profile->'bahagian_b'->>'menaakul')::numeric >= 8)::int b_menaakul_baik,
    count(*) filter (where (c.profile->'bahagian_b'->>'menaakul')::numeric < 8)::int b_menaakul_kurang,
    count(*) filter (where c.fmt='T6_APTITUD' and c.profile->'bahagian_b'->>'menaakul' is null)::int b_menaakul_tiada,
    count(*) filter (where (c.profile->'bahagian_b'->>'masalah')::numeric >= 8)::int b_masalah_baik,
    count(*) filter (where (c.profile->'bahagian_b'->>'masalah')::numeric < 8)::int b_masalah_kurang,
    count(*) filter (where c.fmt='T6_APTITUD' and c.profile->'bahagian_b'->>'masalah' is null)::int b_masalah_tiada
  from cls c where c.fmt in ('T5_IKEP','T6_APTITUD') group by 1,2
),
t4skill as (
  select c.yl, c.cn, a->>'key' key, min(a->>'label') label, min(a->>'section') section,
    min((a->>'max')::int) max_mark,
    count(*) filter (where (a->>'baik')::boolean)::int baik,
    count(*) filter (where not (a->>'baik')::boolean)::int kurang,
    min(ord)::int ord
  from cls c, jsonb_array_elements(c.profile->'aptitude') with ordinality as x(a, ord)
  where c.fmt = 'T4_APTITUD' group by 1,2,3
),
t4pupil as (
  select c.yl, c.cn,
    round(100.0 * sum((a->>'score')::numeric) filter (where a->>'section'='BM') / nullif(sum((a->>'max')::numeric) filter (where a->>'section'='BM'),0)) bm,
    round(100.0 * sum((a->>'score')::numeric) filter (where a->>'section'='BI') / nullif(sum((a->>'max')::numeric) filter (where a->>'section'='BI'),0)) bi,
    round(100.0 * sum((a->>'score')::numeric) filter (where a->>'section'='LM') / nullif(sum((a->>'max')::numeric) filter (where a->>'section'='LM'),0)) lm,
    round(100.0 * sum((a->>'score')::numeric) filter (where a->>'section' in ('BM','BI')) / nullif(sum((a->>'max')::numeric) filter (where a->>'section' in ('BM','BI')),0)) vl
  from cls c, jsonb_array_elements(c.profile->'aptitude') a
  where c.fmt = 'T4_APTITUD' group by c.yl, c.cn, c.profile->>'mykid'
),
t4class as (
  select yl, cn, round(avg(bm))::int bm, round(avg(bi))::int bi, round(avg(lm))::int lm,
    count(*) filter (where vl > lm)::int strong_vl, count(*) filter (where lm > vl)::int strong_lm, count(*) filter (where vl = lm)::int strong_both
  from t4pupil group by 1,2
),
base as (select yl, cn, min(fmt) fmt, count(*)::int pupils from cls group by 1,2)
select b.yl as year_level, b.cn as class_name, b.fmt as format, b.pupils,
  case when b.fmt = 'T4_APTITUD' then jsonb_build_object(
      'sections', (select jsonb_build_object('BM', t.bm, 'BI', t.bi, 'LM', t.lm) from t4class t where t.yl=b.yl and t.cn=b.cn),
      'strength', (select jsonb_build_object('VL', t.strong_vl, 'LM', t.strong_lm, 'BOTH', t.strong_both) from t4class t where t.yl=b.yl and t.cn=b.cn),
      'skills', (select jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label, 'section', k.section, 'max', k.max_mark, 'baik', k.baik, 'kurang', k.kurang) order by k.ord) from t4skill k where k.yl=b.yl and k.cn=b.cn))
  else jsonb_build_object(
      'intelligences', (select jsonb_object_agg(m.code, jsonb_build_object('avg', m.avg, 'dominant', m.dom, 'tinggi', m.tinggi, 'sederhana', m.sederhana, 'rendah', m.rendah)) from mi m where m.yl=b.yl and m.cn=b.cn),
      'tied', (select x.tied from mi_class x where x.yl=b.yl and x.cn=b.cn),
      'bahagian_b', case when b.fmt='T6_APTITUD' then (select jsonb_build_object(
          'menaakul', jsonb_build_object('baik', x.b_menaakul_baik, 'kurang', x.b_menaakul_kurang, 'tiada', x.b_menaakul_tiada),
          'masalah', jsonb_build_object('baik', x.b_masalah_baik, 'kurang', x.b_masalah_kurang, 'tiada', x.b_masalah_tiada)) from mi_class x where x.yl=b.yl and x.cn=b.cn) end)
  end as summary
from base b
order by b.yl, b.cn

$$;

revoke all on function public.v2_public_psychometric_years() from public;
revoke all on function public.v2_public_psychometric_summary(int) from public;
grant execute on function public.v2_public_psychometric_years() to anon, authenticated;
grant execute on function public.v2_public_psychometric_summary(int) to anon, authenticated;
