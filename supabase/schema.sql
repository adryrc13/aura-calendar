-- Aura Calendar - Fase 4A
-- Ejecutar en Supabase SQL Editor. No incluye calendarios compartidos ni roles.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mi calendario',
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  date date not null,
  time text not null,
  end_time text,
  completed boolean not null default false,
  color text not null default 'cyan',
  text_color text not null default '#0c1830',
  reminder_enabled boolean not null default false,
  reminder_minutes_before integer not null default 10,
  reminder_silent boolean not null default false,
  recurrence_type text not null default 'none',
  recurrence_interval integer not null default 1,
  recurrence_days_of_week jsonb not null default '[]'::jsonb,
  recurrence_days_of_month jsonb not null default '[]'::jsonb,
  recurrence_end_date date,
  recurrence_count integer,
  recurrence_rule text,
  parent_task_id uuid references public.tasks(id) on delete set null,
  exception_dates jsonb not null default '[]'::jsonb,
  modified_occurrences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  name text not null,
  mime_type text,
  size integer,
  -- Fase 4B/4C: guardar aquí la ruta de Supabase Storage para archivos remotos.
  storage_path text,
  url text,
  text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists calendars_set_updated_at on public.calendars;
create trigger calendars_set_updated_at before update on public.calendars
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists task_attachments_set_updated_at on public.task_attachments;
create trigger task_attachments_set_updated_at before update on public.task_attachments
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.calendars enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;

drop policy if exists "Profiles are visible to owner" on public.profiles;
create policy "Profiles are visible to owner"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Profiles can be inserted by owner" on public.profiles;
create policy "Profiles can be inserted by owner"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "Calendars are visible to owner" on public.calendars;
create policy "Calendars are visible to owner"
  on public.calendars for select
  using (owner_id = auth.uid());

drop policy if exists "Calendars are insertable by owner" on public.calendars;
create policy "Calendars are insertable by owner"
  on public.calendars for insert
  with check (owner_id = auth.uid());

drop policy if exists "Calendars are editable by owner" on public.calendars;
create policy "Calendars are editable by owner"
  on public.calendars for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Calendars are deletable by owner" on public.calendars;
create policy "Calendars are deletable by owner"
  on public.calendars for delete
  using (owner_id = auth.uid());

drop policy if exists "Tasks are visible to owner" on public.tasks;
create policy "Tasks are visible to owner"
  on public.tasks for select
  using (owner_id = auth.uid());

drop policy if exists "Tasks are insertable by owner" on public.tasks;
create policy "Tasks are insertable by owner"
  on public.tasks for insert
  with check (owner_id = auth.uid());

drop policy if exists "Tasks are editable by owner" on public.tasks;
create policy "Tasks are editable by owner"
  on public.tasks for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Tasks are deletable by owner" on public.tasks;
create policy "Tasks are deletable by owner"
  on public.tasks for delete
  using (owner_id = auth.uid());

drop policy if exists "Task attachments are visible to owner" on public.task_attachments;
create policy "Task attachments are visible to owner"
  on public.task_attachments for select
  using (owner_id = auth.uid());

drop policy if exists "Task attachments are insertable by owner" on public.task_attachments;
create policy "Task attachments are insertable by owner"
  on public.task_attachments for insert
  with check (owner_id = auth.uid());

drop policy if exists "Task attachments are editable by owner" on public.task_attachments;
create policy "Task attachments are editable by owner"
  on public.task_attachments for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Task attachments are deletable by owner" on public.task_attachments;
create policy "Task attachments are deletable by owner"
  on public.task_attachments for delete
  using (owner_id = auth.uid());
