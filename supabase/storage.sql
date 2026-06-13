-- Aura Calendar - Fase 4C
-- Ejecutar en Supabase SQL Editor. No usa service_role y no desactiva RLS.
-- Bucket privado para rutas: {userId}/{taskId}/{attachmentId}-{safeFileName}

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760;

grant select, insert, update, delete on public.task_attachments to authenticated;

alter table public.task_attachments enable row level security;

drop policy if exists "Task attachments are visible to owner" on public.task_attachments;
create policy "Task attachments are visible to owner"
  on public.task_attachments for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Task attachments are insertable by owner" on public.task_attachments;
create policy "Task attachments are insertable by owner"
  on public.task_attachments for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      where tasks.id = task_attachments.task_id
        and tasks.owner_id = auth.uid()
    )
  );

drop policy if exists "Task attachments are editable by owner" on public.task_attachments;
create policy "Task attachments are editable by owner"
  on public.task_attachments for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      where tasks.id = task_attachments.task_id
        and tasks.owner_id = auth.uid()
    )
  );

drop policy if exists "Task attachments are deletable by owner" on public.task_attachments;
create policy "Task attachments are deletable by owner"
  on public.task_attachments for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Task attachment files are readable by owner folder" on storage.objects;
create policy "Task attachment files are readable by owner folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Task attachment files are insertable by owner folder" on storage.objects;
create policy "Task attachment files are insertable by owner folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Task attachment files are editable by owner folder" on storage.objects;
create policy "Task attachment files are editable by owner folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Task attachment files are deletable by owner folder" on storage.objects;
create policy "Task attachment files are deletable by owner folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
