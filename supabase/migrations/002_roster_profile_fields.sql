-- Preserve the full authoritative roster profile so future admin features do not require repeated roster uploads.
alter table public.v2_students
  add column if not exists hostel_status text,
  add column if not exists hostel_name text,
  add column if not exists oku_verified_date text,
  add column if not exists oku_registration_no text,
  add column if not exists oku_registered_date text,
  add column if not exists oku_card_date text,
  add column if not exists orphan_status text;
