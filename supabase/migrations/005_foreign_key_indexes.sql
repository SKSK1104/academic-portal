-- Cover frequently joined foreign keys before assessment data grows.
create index if not exists v2_academic_benchmarks_subject_id_idx on public.v2_academic_benchmarks(subject_id);
create index if not exists v2_academic_marks_enrolment_id_idx on public.v2_academic_marks(enrolment_id);
create index if not exists v2_academic_marks_source_import_id_idx on public.v2_academic_marks(source_import_id);
create index if not exists v2_academic_marks_subject_id_idx on public.v2_academic_marks(subject_id);
create index if not exists v2_intelligence_profiles_source_import_id_idx on public.v2_intelligence_profiles(source_import_id);
create index if not exists v2_pbd_records_enrolment_id_idx on public.v2_pbd_records(enrolment_id);
create index if not exists v2_pbd_records_source_import_id_idx on public.v2_pbd_records(source_import_id);
create index if not exists v2_pbd_records_subject_id_idx on public.v2_pbd_records(subject_id);
