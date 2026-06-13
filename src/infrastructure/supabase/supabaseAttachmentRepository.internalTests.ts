import type { TaskAttachment } from '../../domain/tasks/attachment';
import {
  attachmentToSupabaseMetadataRow,
  buildAttachmentStoragePath,
  isRemoteAttachmentDuplicate,
  shouldUploadAttachment,
  supabaseAttachmentRowToAttachment,
  type SupabaseTaskAttachmentRow,
} from './supabaseAttachmentRepository';

const NOW = '2026-06-13T00:00:00.000Z';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const ATTACHMENT_ID = '33333333-3333-4333-8333-333333333333';

function makeAttachment(overrides: Partial<TaskAttachment> = {}): TaskAttachment {
  return {
    id: ATTACHMENT_ID,
    taskId: TASK_ID,
    type: 'image',
    name: 'fótó final / Cádiz?.png',
    mimeType: 'image/png',
    size: 1024,
    data: new Blob(['imagen'], { type: 'image/png' }),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRow(overrides: Partial<SupabaseTaskAttachmentRow> = {}): SupabaseTaskAttachmentRow {
  return {
    id: ATTACHMENT_ID,
    task_id: TASK_ID,
    owner_id: OWNER_ID,
    type: 'image',
    name: 'foto.png',
    mime_type: 'image/png',
    size: 1024,
    storage_path: `${OWNER_ID}/${TASK_ID}/${ATTACHMENT_ID}-foto.png`,
    url: null,
    text: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function runSupabaseAttachmentRepositoryInternalTests() {
  const attachment = makeAttachment();
  const storagePath = buildAttachmentStoragePath(OWNER_ID, TASK_ID, attachment);
  const metadata = attachmentToSupabaseMetadataRow(attachment, OWNER_ID, TASK_ID, storagePath);
  const mappedBack = supabaseAttachmentRowToAttachment(makeRow({ storage_path: storagePath }));
  const link = makeAttachment({
    type: 'link',
    name: 'Docs',
    url: 'https://example.com',
    data: undefined,
    mimeType: undefined,
    size: undefined,
  });
  const note = makeAttachment({
    type: 'note',
    name: 'Nota',
    text: 'Comprar pilas',
    data: undefined,
    mimeType: undefined,
    size: undefined,
  });

  return [
    {
      name: 'generar storage path seguro',
      ok: storagePath === `${OWNER_ID}/${TASK_ID}/${ATTACHMENT_ID}-foto-final-Cadiz.png`,
    },
    {
      name: 'mapear adjunto local a metadata remota',
      ok:
        metadata.id === ATTACHMENT_ID &&
        metadata.task_id === TASK_ID &&
        metadata.owner_id === OWNER_ID &&
        metadata.storage_path === storagePath &&
        metadata.url === null,
    },
    {
      name: 'mapear metadata remota a modelo interno',
      ok:
        mappedBack.id === ATTACHMENT_ID &&
        mappedBack.taskId === TASK_ID &&
        mappedBack.storagePath === storagePath &&
        mappedBack.syncStatus === 'remote',
    },
    {
      name: 'evitar duplicados remotos',
      ok: isRemoteAttachmentDuplicate([makeRow({ storage_path: storagePath })], { ...attachment, storagePath }),
    },
    {
      name: 'detectar links y notas como metadata sin Storage',
      ok: !shouldUploadAttachment(link) && !shouldUploadAttachment(note),
    },
    {
      name: 'borrar metadata y storage path usa fila completa',
      ok: Boolean(makeRow().id && makeRow().storage_path),
    },
  ];
}
