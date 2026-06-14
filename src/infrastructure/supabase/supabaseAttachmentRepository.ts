import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  canUploadAttachmentToStorage,
  getAttachmentBlob,
  safeStorageFileName,
  shouldStoreAttachmentOnlyAsMetadata,
  type TaskAttachment,
  type TaskAttachmentSyncStatus,
  type TaskAttachmentType,
} from '../../domain/tasks/attachment';
import type { Task } from '../../domain/tasks/task';

export const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

export interface SupabaseTaskAttachmentRow {
  id: string;
  task_id: string;
  owner_id: string;
  type: string;
  name: string;
  mime_type: string | null;
  size: number | null;
  storage_path: string | null;
  url: string | null;
  text: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteAttachmentSyncResult {
  uploaded: number;
  skippedDuplicates: number;
  deleted: number;
  errors: string[];
}

export interface LocalAttachmentMigrationSummary {
  attachmentsFound: number;
  attachmentsUploaded: number;
  attachmentsSkipped: number;
  errors: string[];
}

export function buildAttachmentStoragePath(userId: string, taskId: string, attachment: Pick<TaskAttachment, 'id' | 'name'>) {
  return `${userId}/${taskId}/${attachment.id}-${safeStorageFileName(attachment.name)}`;
}

export function supabaseAttachmentRowToAttachment(row: SupabaseTaskAttachmentRow): TaskAttachment {
  const type = normalizeAttachmentType(row.type);
  const syncStatus: TaskAttachmentSyncStatus = row.storage_path || type === 'link' || type === 'note' ? 'remote' : 'pending';

  return {
    id: row.id,
    remoteId: row.id,
    taskId: row.task_id,
    type,
    name: row.name,
    mimeType: row.mime_type ?? undefined,
    size: row.size ?? undefined,
    storagePath: row.storage_path ?? undefined,
    url: row.url ?? undefined,
    text: row.text ?? undefined,
    syncStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function attachmentToSupabaseMetadataRow(
  attachment: TaskAttachment,
  ownerId: string,
  taskId: string,
  storagePath = attachment.storagePath,
) {
  return {
    id: attachment.remoteId ?? attachment.id,
    task_id: taskId,
    owner_id: ownerId,
    type: attachment.type,
    name: attachment.name,
    mime_type: attachment.mimeType ?? null,
    size: attachment.size ?? null,
    storage_path: storagePath ?? null,
    url: attachment.type === 'link' ? attachment.url ?? null : null,
    text: attachment.text ?? null,
    created_at: attachment.createdAt,
    updated_at: attachment.updatedAt,
  };
}

export function isRemoteAttachmentDuplicate(existing: SupabaseTaskAttachmentRow[], attachment: TaskAttachment) {
  return existing.some((row) => {
    if (row.id === attachment.id || row.id === attachment.remoteId) return true;
    if (row.type !== attachment.type) return false;
    if (row.storage_path && attachment.storagePath && row.storage_path === attachment.storagePath) return true;

    return (
      row.name === attachment.name &&
      (row.size ?? undefined) === attachment.size &&
      (row.url ?? undefined) === attachment.url &&
      (row.text ?? undefined) === attachment.text
    );
  });
}

export function shouldUploadAttachment(attachment: TaskAttachment) {
  return canUploadAttachmentToStorage(attachment);
}

export async function listRemoteAttachmentsForTask(client: SupabaseClient, _ownerId: string, taskId: string) {
  const { data, error } = await client
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`No pudimos leer adjuntos remotos: ${error.message}`);
  }

  return (data ?? []) as SupabaseTaskAttachmentRow[];
}

export async function listRemoteAttachmentsForTasks(client: SupabaseClient, _ownerId: string, taskIds: string[]) {
  if (!taskIds.length) return [];

  const { data, error } = await client
    .from('task_attachments')
    .select('*')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`No pudimos leer adjuntos remotos: ${error.message}`);
  }

  return (data ?? []) as SupabaseTaskAttachmentRow[];
}

export async function downloadRemoteAttachment(client: SupabaseClient, attachment: Pick<TaskAttachment, 'storagePath' | 'name'>) {
  if (!attachment.storagePath) {
    throw new Error('El adjunto remoto no tiene ruta de Storage.');
  }

  const { data, error } = await client.storage.from(TASK_ATTACHMENTS_BUCKET).download(attachment.storagePath);

  if (error || !data) {
    throw new Error(`No pudimos descargar el adjunto remoto "${attachment.name}": ${error?.message ?? 'respuesta vacía'}`);
  }

  return data;
}

export async function syncRemoteTaskAttachments(
  client: SupabaseClient,
  ownerId: string,
  task: Task,
): Promise<RemoteAttachmentSyncResult> {
  const existing = await listRemoteAttachmentsForTask(client, ownerId, task.id);
  const desired = task.attachments ?? [];
  const desiredIds = new Set(desired.map((attachment) => attachment.remoteId ?? attachment.id));
  const result: RemoteAttachmentSyncResult = {
    uploaded: 0,
    skippedDuplicates: 0,
    deleted: 0,
    errors: [],
  };

  for (const row of existing) {
    if (!desiredIds.has(row.id)) {
      try {
        await deleteRemoteAttachment(client, row);
        result.deleted += 1;
      } catch (error) {
        result.errors.push(errorMessage(error));
      }
    }
  }

  const rowsAfterDelete = existing.filter((row) => desiredIds.has(row.id));

  for (const attachment of desired) {
    try {
      if (isRemoteAttachmentDuplicate(rowsAfterDelete, attachment)) {
        if (attachment.storagePath || shouldStoreAttachmentOnlyAsMetadata(attachment)) {
          await upsertRemoteAttachmentMetadata(client, ownerId, task.id, attachment, attachment.storagePath);
        }
        result.skippedDuplicates += 1;
        continue;
      }

      if (shouldStoreAttachmentOnlyAsMetadata(attachment) || attachment.storagePath) {
        await upsertRemoteAttachmentMetadata(client, ownerId, task.id, attachment, attachment.storagePath);
        result.uploaded += 1;
        continue;
      }

      if (shouldUploadAttachment(attachment)) {
        await uploadRemoteAttachment(client, ownerId, task.id, attachment);
        result.uploaded += 1;
      }
    } catch (error) {
      result.errors.push(`${attachment.name}: ${errorMessage(error)}`);
    }
  }

  return result;
}

export async function uploadMissingRemoteTaskAttachments(
  client: SupabaseClient,
  ownerId: string,
  taskId: string,
  attachments: TaskAttachment[],
): Promise<LocalAttachmentMigrationSummary> {
  const existing = await listRemoteAttachmentsForTask(client, ownerId, taskId);
  const summary: LocalAttachmentMigrationSummary = {
    attachmentsFound: attachments.length,
    attachmentsUploaded: 0,
    attachmentsSkipped: 0,
    errors: [],
  };

  for (const attachment of attachments) {
    try {
      if (isRemoteAttachmentDuplicate(existing, attachment)) {
        summary.attachmentsSkipped += 1;
        continue;
      }

      if (shouldStoreAttachmentOnlyAsMetadata(attachment) || attachment.storagePath) {
        await upsertRemoteAttachmentMetadata(client, ownerId, taskId, attachment, attachment.storagePath);
        summary.attachmentsUploaded += 1;
        continue;
      }

      if (shouldUploadAttachment(attachment)) {
        const storagePath = await uploadRemoteAttachment(client, ownerId, taskId, attachment);
        existing.push({
          ...attachmentToSupabaseMetadataRow(attachment, ownerId, taskId, storagePath),
          storage_path: storagePath,
        });
        summary.attachmentsUploaded += 1;
      } else {
        summary.attachmentsSkipped += 1;
      }
    } catch (error) {
      summary.errors.push(`${attachment.name}: ${errorMessage(error)}`);
    }
  }

  return summary;
}

export async function uploadRemoteAttachment(client: SupabaseClient, ownerId: string, taskId: string, attachment: TaskAttachment) {
  const blob = getAttachmentBlob(attachment);

  if (!blob) {
    throw new Error('El archivo local no está disponible para subir.');
  }

  if (blob.size > MAX_ATTACHMENT_SIZE_BYTES || (attachment.size ?? 0) > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }

  const storagePath = buildAttachmentStoragePath(ownerId, taskId, attachment);
  const { error: uploadError } = await client.storage.from(TASK_ATTACHMENTS_BUCKET).upload(storagePath, blob, {
    contentType: attachment.mimeType || blob.type || 'application/octet-stream',
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Storage rechazó la subida: ${uploadError.message}`);
  }

  try {
    await upsertRemoteAttachmentMetadata(client, ownerId, taskId, attachment, storagePath);
  } catch (error) {
    await client.storage.from(TASK_ATTACHMENTS_BUCKET).remove([storagePath]);
    throw error;
  }

  return storagePath;
}

export async function upsertRemoteAttachmentMetadata(
  client: SupabaseClient,
  ownerId: string,
  taskId: string,
  attachment: TaskAttachment,
  storagePath?: string,
) {
  const row = attachmentToSupabaseMetadataRow(attachment, ownerId, taskId, storagePath);
  const { error } = await client.from('task_attachments').upsert(row, { onConflict: 'id' });

  if (error) {
    throw new Error(`No pudimos guardar metadata del adjunto: ${error.message}`);
  }
}

export async function deleteRemoteAttachment(client: SupabaseClient, row: SupabaseTaskAttachmentRow) {
  const errors: string[] = [];

  if (row.storage_path) {
    const { error } = await client.storage.from(TASK_ATTACHMENTS_BUCKET).remove([row.storage_path]);
    if (error) errors.push(`Storage: ${error.message}`);
  }

  const { error } = await client.from('task_attachments').delete().eq('id', row.id);
  if (error) errors.push(`metadata: ${error.message}`);

  if (errors.length) {
    throw new Error(`No pudimos eliminar "${row.name}": ${errors.join('; ')}`);
  }
}

export async function deleteRemoteAttachmentsForTask(client: SupabaseClient, ownerId: string, taskId: string) {
  const rows = await listRemoteAttachmentsForTask(client, ownerId, taskId);
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await deleteRemoteAttachment(client, row);
    } catch (error) {
      errors.push(errorMessage(error));
    }
  }

  return errors;
}

function normalizeAttachmentType(type: string): TaskAttachmentType {
  const known: TaskAttachmentType[] = ['image', 'pdf', 'audio', 'video', 'document', 'link', 'note'];
  return known.includes(type as TaskAttachmentType) ? (type as TaskAttachmentType) : 'document';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
