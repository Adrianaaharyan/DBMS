-- PlaceIQ database schema for Supabase (PostgreSQL).
-- Run once: Supabase dashboard > SQL Editor > New query > paste this file > Run.
-- Safe to run again: every statement is "if not exists" or drops its own policy first.

create table if not exists students (
  id          text primary key,
  name        text not null,
  roll        text not null default '',
  branch      text not null,
  cgpa        numeric(4,2) not null default 0,
  backlogs    integer not null default 0,
  skills      text[] not null default '{}',
  aptitude    integer not null default 0,
  projects    integer not null default 0,
  internships integer not null default 0
);

create table if not exists drives (
  id         text primary key,
  company    text not null,
  role       text not null,
  ctc        numeric(5,2) not null default 0,
  min_cgpa   numeric(4,2) not null default 0,
  max_back   integer not null default 0,
  branches   text[] not null default '{}',
  skills     text[] not null default '{}',
  drive_date date not null,
  status     text not null check (status in ('Open', 'Upcoming', 'Completed'))
);

create table if not exists applications (
  student_id text not null references students(id) on delete cascade,
  drive_id   text not null references drives(id)   on delete cascade,
  stage      text not null check (stage in ('Applied', 'Shortlisted', 'Interview', 'Offered', 'Rejected')),
  primary key (student_id, drive_id)
);

-- Alerts a student has marked as read (the alerts themselves are computed, not stored).
create table if not exists notif_read (
  student_id text not null references students(id) on delete cascade,
  alert_id   text not null,
  primary key (student_id, alert_id)
);

-- Prep-plan steps a student has ticked off.
create table if not exists prep_done (
  student_id text not null references students(id) on delete cascade,
  drive_id   text not null references drives(id)   on delete cascade,
  step_id    text not null,
  primary key (student_id, drive_id, step_id)
);

-- "sample" or "imported": decides whether the sample-data banner is shown.
create table if not exists app_settings (
  key   text primary key,
  value text not null
);

create index if not exists applications_drive_idx on applications (drive_id);

-- Row Level Security.
-- WARNING: PlaceIQ has no sign-in, so these policies let ANYONE who has your site address
-- read, change and delete every row through the public API. That is fine for a demo with
-- sample data. Do NOT load real student records until you add sign-in and replace these
-- policies with role-based ones (see docs/SUPABASE_SETUP.md, "Before using real data").
do $$
declare t text;
begin
  foreach t in array array['students','drives','applications','notif_read','prep_done','app_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo open access" on %I', t);
    execute format('create policy "demo open access" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;
