-- Aura Calendar - Fase 5
-- Calendarios compartidos con roles, invitaciones, RLS y Storage privado.
-- Ejecutar en Supabase SQL Editor despues de schema.sql y storage.sql.

create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.calendar_members (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(calendar_id, user_id)
);

create table if not exists public.calendar_invitations (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  token text unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(calendar_id, invited_email, status)
);

create index if not exists calendar_members_calendar_id_idx on public.calendar_members(calendar_id);
create index if not exists calendar_members_user_id_idx on public.calendar_members(user_id);
create index if not exists calendar_invitations_calendar_id_idx on public.calendar_invitations(calendar_id);
create index if not exists calendar_invitations_invited_email_status_idx on public.calendar_invitations(lower(invited_email), status);
create index if not exists tasks_calendar_id_idx on public.tasks(calendar_id);
create index if not exists task_attachments_task_id_idx on public.task_attachments(task_id);
create index if not exists task_attachments_storage_path_idx on public.task_attachments(storage_path);

drop trigger if exists calendar_members_set_updated_at on public.calendar_members;
create trigger calendar_members_set_updated_at before update on public.calendar_members
  for each row execute function public.set_updated_at();

drop trigger if exists calendar_invitations_set_updated_at on public.calendar_invitations;
create trigger calendar_invitations_set_updated_at before update on public.calendar_invitations
  for each row execute function public.set_updated_at();

create or replace function private.calendar_role(target_calendar_id uuid, target_user_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select cm.role
  from public.calendar_members cm
  where cm.calendar_id = target_calendar_id
    and cm.user_id = target_user_id
  limit 1
$$;

create or replace function private.has_calendar_role(target_calendar_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(private.calendar_role(target_calendar_id, (select auth.uid())) = any(allowed_roles), false)
$$;

create or replace function private.uuid_from_text(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function private.task_calendar_id(target_task_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select t.calendar_id
  from public.tasks t
  where t.id = target_task_id
  limit 1
$$;

create or replace function private.storage_task_id(path text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select private.uuid_from_text((storage.foldername(path))[2])
$$;

create or replace function private.can_read_attachment_storage(path text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.task_attachments ta
    join public.tasks t on t.id = ta.task_id
    where ta.storage_path = path
      and private.has_calendar_role(t.calendar_id, array['owner', 'editor', 'viewer'])
  )
$$;

create or replace function private.can_delete_attachment_storage(path text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.task_attachments ta
    join public.tasks t on t.id = ta.task_id
    where ta.storage_path = path
      and (
        ta.owner_id = (select auth.uid())
        or private.has_calendar_role(t.calendar_id, array['owner', 'editor'])
      )
  )
$$;

create or replace function public.add_calendar_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calendar_members (calendar_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (calendar_id, user_id) do update
    set role = 'owner',
        updated_at = now();

  return new;
end;
$$;

create or replace function public.set_calendar_owner_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.owner_id is null then
    new.owner_id := (select auth.uid());
  end if;

  return new;
end;
$$;

create or replace function public.accept_calendar_invitation(invitation_id uuid)
returns public.calendar_invitations
language plpgsql
security invoker
set search_path = public
as $$
declare
  invitation public.calendar_invitations%rowtype;
  current_user_id uuid := (select auth.uid());
  current_email text := lower((select auth.jwt() ->> 'email'));
begin
  if current_user_id is null or current_email is null or current_email = '' then
    raise exception 'No hay una sesion autenticada para aceptar la invitacion.';
  end if;

  select ci.*
    into invitation
  from public.calendar_invitations ci
  where ci.id = invitation_id
    and lower(ci.invited_email) = current_email
    and ci.status in ('pending', 'accepted')
  limit 1;

  if not found then
    raise exception 'No encontramos una invitacion pendiente o recuperable para este usuario.';
  end if;

  if invitation.status = 'pending' then
    update public.calendar_invitations
      set status = 'accepted',
          accepted_at = coalesce(accepted_at, now())
    where id = invitation.id
      and status = 'pending'
    returning * into invitation;

    if not found then
      raise exception 'No pudimos marcar la invitacion como aceptada.';
    end if;
  end if;

  insert into public.calendar_members (calendar_id, user_id, role)
  values (invitation.calendar_id, current_user_id, invitation.role)
  on conflict (calendar_id, user_id) do nothing;

  if not exists (
    select 1
    from public.calendar_members cm
    where cm.calendar_id = invitation.calendar_id
      and cm.user_id = current_user_id
  ) then
    raise exception 'No pudimos crear la membresia del calendario compartido.';
  end if;

  return invitation;
end;
$$;

insert into public.calendar_members (calendar_id, user_id, role)
select c.id, c.owner_id, 'owner'
from public.calendars c
on conflict (calendar_id, user_id) do update
  set role = 'owner',
      updated_at = now();

insert into public.calendar_members (calendar_id, user_id, role)
select ci.calendar_id, au.id, ci.role
from public.calendar_invitations ci
join auth.users au
  on lower(au.email) = lower(ci.invited_email)
where ci.status = 'accepted'
on conflict (calendar_id, user_id) do update
  set role = case
        when public.calendar_members.role = 'owner' then public.calendar_members.role
        else excluded.role
      end,
      updated_at = now();

drop trigger if exists calendars_set_owner_id on public.calendars;
create trigger calendars_set_owner_id
  before insert on public.calendars
  for each row execute function public.set_calendar_owner_id();

drop trigger if exists calendars_add_owner_membership on public.calendars;
create trigger calendars_add_owner_membership
  after insert on public.calendars
  for each row execute function public.add_calendar_owner_membership();

grant select, insert, update, delete on public.calendar_members to authenticated;
grant select, insert, update, delete on public.calendar_invitations to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.calendar_role(uuid, uuid) to authenticated;
grant execute on function private.has_calendar_role(uuid, text[]) to authenticated;
grant execute on function private.uuid_from_text(text) to authenticated;
grant execute on function private.task_calendar_id(uuid) to authenticated;
grant execute on function private.storage_task_id(text) to authenticated;
grant execute on function private.can_read_attachment_storage(text) to authenticated;
grant execute on function private.can_delete_attachment_storage(text) to authenticated;
grant execute on function public.accept_calendar_invitation(uuid) to authenticated;

alter table public.calendar_members enable row level security;
alter table public.calendar_invitations enable row level security;
alter table public.calendars enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;

drop policy if exists "Profiles are visible to owner" on public.profiles;
drop policy if exists "Profiles are visible to self or calendar co-members" on public.profiles;

create policy "Profiles are visible to self or calendar co-members"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.calendar_members me
    join public.calendar_members other
      on other.calendar_id = me.calendar_id
    where me.user_id = (select auth.uid())
      and other.user_id = profiles.id
  )
);

drop policy if exists "Calendar members are visible to members" on public.calendar_members;
create policy "Calendar members are visible to members"
  on public.calendar_members for select
  to authenticated
  using (private.has_calendar_role(calendar_id, array['owner', 'editor', 'viewer']));

drop policy if exists "Owners manage calendar members" on public.calendar_members;
create policy "Owners manage calendar members"
  on public.calendar_members for update
  to authenticated
  using (private.has_calendar_role(calendar_id, array['owner']) and role <> 'owner')
  with check (private.has_calendar_role(calendar_id, array['owner']) and role in ('editor', 'viewer'));

drop policy if exists "Owners remove calendar members" on public.calendar_members;
create policy "Owners remove calendar members"
  on public.calendar_members for delete
  to authenticated
  using (private.has_calendar_role(calendar_id, array['owner']) and role <> 'owner');

drop policy if exists "Invited users can join calendars" on public.calendar_members;
create policy "Invited users can join calendars"
  on public.calendar_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role in ('editor', 'viewer')
    and exists (
      select 1
      from public.calendar_invitations ci
      where ci.calendar_id = calendar_members.calendar_id
        and lower(ci.invited_email) = lower((select auth.jwt() ->> 'email'))
        and ci.role = calendar_members.role
        and ci.status in ('pending', 'accepted')
    )
  );

drop policy if exists "Calendar invitations visible to owner or invited email" on public.calendar_invitations;
create policy "Calendar invitations visible to owner or invited email"
  on public.calendar_invitations for select
  to authenticated
  using (
    invited_by = (select auth.uid())
    or lower(invited_email) = lower((select auth.jwt() ->> 'email'))
    or private.has_calendar_role(calendar_id, array['owner'])
  );

drop policy if exists "Owners create calendar invitations" on public.calendar_invitations;
create policy "Owners create calendar invitations"
  on public.calendar_invitations for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and status = 'pending'
    and role in ('editor', 'viewer')
    and private.has_calendar_role(calendar_id, array['owner'])
  );

drop policy if exists "Owners cancel calendar invitations" on public.calendar_invitations;
create policy "Owners cancel calendar invitations"
  on public.calendar_invitations for update
  to authenticated
  using (
    status = 'pending'
    and (
      private.has_calendar_role(calendar_id, array['owner'])
      or lower(invited_email) = lower((select auth.jwt() ->> 'email'))
    )
  )
  with check (
    status in ('accepted', 'declined', 'cancelled')
    and (
      private.has_calendar_role(calendar_id, array['owner'])
      or lower(invited_email) = lower((select auth.jwt() ->> 'email'))
    )
  );

drop policy if exists "Calendars are visible to owner" on public.calendars;
drop policy if exists "Calendars are visible to members" on public.calendars;
create policy "Calendars are visible to members"
  on public.calendars for select
  to authenticated
  using (owner_id = (select auth.uid()) or private.has_calendar_role(id, array['owner', 'editor', 'viewer']));

drop policy if exists "Calendars are insertable by owner" on public.calendars;
create policy "Calendars are insertable by owner"
  on public.calendars for insert
  to authenticated
  with check (coalesce(owner_id, (select auth.uid())) = (select auth.uid()));

drop policy if exists "Calendars are editable by owner" on public.calendars;
drop policy if exists "Calendars are editable by owner or editor" on public.calendars;
create policy "Calendars are editable by owner or editor"
  on public.calendars for update
  to authenticated
  using (private.has_calendar_role(id, array['owner', 'editor']))
  with check (private.has_calendar_role(id, array['owner', 'editor']));

drop policy if exists "Calendars are deletable by owner" on public.calendars;
create policy "Calendars are deletable by owner"
  on public.calendars for delete
  to authenticated
  using (private.has_calendar_role(id, array['owner']));

drop policy if exists "Tasks are visible to owner" on public.tasks;
drop policy if exists "Tasks are visible to calendar members" on public.tasks;
create policy "Tasks are visible to calendar members"
  on public.tasks for select
  to authenticated
  using (private.has_calendar_role(calendar_id, array['owner', 'editor', 'viewer']));

drop policy if exists "Tasks are insertable by owner" on public.tasks;
drop policy if exists "Tasks are insertable by calendar editors" on public.tasks;
create policy "Tasks are insertable by calendar editors"
  on public.tasks for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.has_calendar_role(calendar_id, array['owner', 'editor'])
  );

drop policy if exists "Tasks are editable by owner" on public.tasks;
drop policy if exists "Tasks are editable by calendar editors" on public.tasks;
create policy "Tasks are editable by calendar editors"
  on public.tasks for update
  to authenticated
  using (private.has_calendar_role(calendar_id, array['owner', 'editor']))
  with check (private.has_calendar_role(calendar_id, array['owner', 'editor']));

drop policy if exists "Tasks are deletable by owner" on public.tasks;
drop policy if exists "Tasks are deletable by calendar editors" on public.tasks;
create policy "Tasks are deletable by calendar editors"
  on public.tasks for delete
  to authenticated
  using (private.has_calendar_role(calendar_id, array['owner', 'editor']));

drop policy if exists "Task attachments are visible to owner" on public.task_attachments;
drop policy if exists "Task attachments are visible to calendar members" on public.task_attachments;
create policy "Task attachments are visible to calendar members"
  on public.task_attachments for select
  to authenticated
  using (
    private.has_calendar_role(private.task_calendar_id(task_id), array['owner', 'editor', 'viewer'])
  );

drop policy if exists "Task attachments are insertable by owner" on public.task_attachments;
drop policy if exists "Task attachments are insertable by calendar editors" on public.task_attachments;
create policy "Task attachments are insertable by calendar editors"
  on public.task_attachments for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.has_calendar_role(private.task_calendar_id(task_id), array['owner', 'editor'])
  );

drop policy if exists "Task attachments are editable by owner" on public.task_attachments;
drop policy if exists "Task attachments are editable by calendar editors" on public.task_attachments;
create policy "Task attachments are editable by calendar editors"
  on public.task_attachments for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.has_calendar_role(private.task_calendar_id(task_id), array['owner', 'editor'])
  )
  with check (
    private.has_calendar_role(private.task_calendar_id(task_id), array['owner', 'editor'])
  );

drop policy if exists "Task attachments are deletable by owner" on public.task_attachments;
drop policy if exists "Task attachments are deletable by uploader or calendar editors" on public.task_attachments;
create policy "Task attachments are deletable by uploader or calendar editors"
  on public.task_attachments for delete
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.has_calendar_role(private.task_calendar_id(task_id), array['owner', 'editor'])
  );

drop policy if exists "Task attachment files are readable by owner folder" on storage.objects;
drop policy if exists "Task attachment files are readable by calendar members" on storage.objects;
create policy "Task attachment files are readable by calendar members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or private.can_read_attachment_storage(name)
    )
  );

drop policy if exists "Task attachment files are insertable by owner folder" on storage.objects;
drop policy if exists "Task attachment files are insertable by calendar editors" on storage.objects;
create policy "Task attachment files are insertable by calendar editors"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and private.has_calendar_role(private.task_calendar_id(private.storage_task_id(name)), array['owner', 'editor'])
  );

drop policy if exists "Task attachment files are editable by owner folder" on storage.objects;
drop policy if exists "Task attachment files are editable by owner folder or calendar editors" on storage.objects;
create policy "Task attachment files are editable by owner folder or calendar editors"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or private.can_delete_attachment_storage(name)
    )
  )
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Task attachment files are deletable by owner folder" on storage.objects;
drop policy if exists "Task attachment files are deletable by uploader or calendar editors" on storage.objects;
create policy "Task attachment files are deletable by uploader or calendar editors"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or private.can_delete_attachment_storage(name)
    )
  );
-- Aura Calendar - Fix RLS tasks para editores de calendarios compartidos
-- Permite que owner/editor creen, editen, completen y eliminen tareas
-- en calendarios compartidos, aunque la tarea haya sido creada por otro usuario.
-- Viewer queda solo lectura.

grant select, insert, update, delete on table public.tasks to authenticated;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
  loop
    execute format('drop policy if exists %I on public.tasks', pol.policyname);
  end loop;
end $$;

create policy "Tasks are visible to calendar members"
on public.tasks
for select
to authenticated
using (
  private.has_calendar_role(calendar_id, array['owner', 'editor', 'viewer'])
);

create policy "Tasks are insertable by calendar editors"
on public.tasks
for insert
to authenticated
with check (
  private.has_calendar_role(calendar_id, array['owner', 'editor'])
);

create policy "Tasks are updateable by calendar editors"
on public.tasks
for update
to authenticated
using (
  private.has_calendar_role(calendar_id, array['owner', 'editor'])
)
with check (
  private.has_calendar_role(calendar_id, array['owner', 'editor'])
);

create policy "Tasks are deletable by calendar editors"
on public.tasks
for delete
to authenticated
using (
  private.has_calendar_role(calendar_id, array['owner', 'editor'])
);