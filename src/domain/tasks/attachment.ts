import { createTranslator, type TranslationParams } from '../../shared/i18n';

export type TaskAttachmentType = 'image' | 'pdf' | 'audio' | 'video' | 'document' | 'link' | 'note';
export type TaskAttachmentSyncStatus = 'local' | 'remote' | 'pending' | 'error';

export interface TaskAttachment {
  id: string;
  taskId: string;
  type: TaskAttachmentType;
  name: string;
  mimeType?: string;
  size?: number;
  /**
   * Fase 3 local: payload binario guardado como Blob/File en IndexedDB.
   * Fase 4C remota: los blobs viven en Supabase Storage y la metadata en Database.
   */
  data?: Blob;
  storagePath?: string;
  url?: string;
  text?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: TaskAttachmentSyncStatus;
  remoteId?: string;
}

export interface AttachmentFileLike {
  name: string;
  type?: string;
  size: number;
}

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

type Translate = (key: string, params?: TranslationParams) => string;

const DOCUMENT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

const DOCUMENT_EXTENSIONS = new Set(['txt', 'csv', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']);
const UNSUPPORTED_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'sh', 'apk', 'app']);

export function detectAttachmentFileType(file: AttachmentFileLike): Exclude<TaskAttachmentType, 'link' | 'note'> | undefined {
  const mimeType = file.type?.toLowerCase() ?? '';
  const extension = fileExtension(file.name);

  if (UNSUPPORTED_EXTENSIONS.has(extension)) return undefined;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (DOCUMENT_MIME_TYPES.has(mimeType) || DOCUMENT_EXTENSIONS.has(extension)) return 'document';

  return undefined;
}

export function validateAttachmentFile(file: AttachmentFileLike, translate: Translate = createTranslator('es')) {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false as const,
      error: translate('attachments.error.sizeLimit', {
        name: file.name,
        maxSize: formatAttachmentSize(MAX_ATTACHMENT_SIZE_BYTES),
      }),
    };
  }

  const type = detectAttachmentFileType(file);

  if (!type) {
    return {
      ok: false as const,
      error: translate('attachments.error.unsupported', { name: file.name }),
    };
  }

  return { ok: true as const, type };
}

export function createFileAttachment(
  file: File,
  id: string,
  taskId = '',
  now = new Date().toISOString(),
  translate: Translate = createTranslator('es'),
): TaskAttachment {
  const validation = validateAttachmentFile(file, translate);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return {
    id,
    taskId,
    type: validation.type,
    name: file.name,
    mimeType: file.type || undefined,
    size: file.size,
    data: file,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

export function createLinkAttachment(
  input: { url: string; title?: string; description?: string },
  id: string,
  taskId = '',
  now = new Date().toISOString(),
  translate: Translate = createTranslator('es'),
): TaskAttachment {
  const url = normalizeExternalUrl(input.url, translate);
  const name = input.title?.trim() || hostnameFor(url) || url;
  const text = input.description?.trim() || undefined;

  return {
    id,
    taskId,
    type: 'link',
    name,
    url,
    text,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

export function createNoteAttachment(
  text: string,
  id: string,
  taskId = '',
  now = new Date().toISOString(),
  translate: Translate = createTranslator('es'),
): TaskAttachment {
  const normalized = text.trim();

  if (!normalized) {
    throw new Error(translate('attachments.error.emptyNote'));
  }

  return {
    id,
    taskId,
    type: 'note',
    name: normalized.length > 34 ? `${normalized.slice(0, 34)}…` : normalized,
    text: normalized,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTaskAttachments(attachments: TaskAttachment[] | undefined, taskId: string, now = new Date().toISOString()) {
  return (attachments ?? []).map((attachment) => ({
    ...attachment,
    taskId,
    name: attachment.name.trim() || labelForAttachmentType(attachment.type),
    data: getAttachmentBlob(attachment),
    syncStatus: attachment.syncStatus ?? inferAttachmentSyncStatus(attachment),
    text: attachment.text?.trim() || undefined,
    updatedAt: attachment.updatedAt || now,
    createdAt: attachment.createdAt || now,
  }));
}

export function getAttachmentBlob(attachment: Pick<TaskAttachment, 'data' | 'mimeType' | 'size'>) {
  const data = attachment.data as unknown;
  const mimeType = attachment.mimeType || (data instanceof Blob ? data.type : undefined) || 'application/octet-stream';
  let blob: Blob | undefined;

  if (data instanceof Blob) {
    blob = data.type ? data : new Blob([data], { type: mimeType });
  } else if (data instanceof ArrayBuffer) {
    blob = new Blob([data], { type: mimeType });
  } else if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    blob = new Blob([bytes], { type: mimeType });
  }

  if (!blob) return undefined;
  if (typeof attachment.size === 'number' && attachment.size > 0 && blob.size === 0) return undefined;

  return blob.type ? blob : new Blob([blob], { type: mimeType });
}

export function hasLocalAttachmentBlob(attachment: Pick<TaskAttachment, 'data' | 'mimeType' | 'size'>) {
  return Boolean(getAttachmentBlob(attachment));
}

export function safeAttachmentFileName(name: string) {
  return (name.trim() || createTranslator('es')('attachments.defaultLocalName')).replace(/[\\/:*?"<>|]+/g, '-');
}

export function safeStorageFileName(name: string) {
  const cleaned = safeAttachmentFileName(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');

  return cleaned || createTranslator('es')('attachments.defaultLocalName');
}

export function canUploadAttachmentToStorage(attachment: Pick<TaskAttachment, 'type' | 'data' | 'mimeType' | 'size'>) {
  return attachment.type !== 'link' && attachment.type !== 'note' && hasLocalAttachmentBlob(attachment);
}

export function shouldStoreAttachmentOnlyAsMetadata(attachment: Pick<TaskAttachment, 'type'>) {
  return attachment.type === 'link' || attachment.type === 'note';
}

export function removeAttachmentById(attachments: TaskAttachment[] | undefined, id: string) {
  return (attachments ?? []).filter((attachment) => attachment.id !== id);
}

export function formatAttachmentSize(size?: number) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function labelForAttachmentType(type: TaskAttachmentType, translate: Translate = createTranslator('es')) {
  return translate(`attachments.type.${type}`);
}

function inferAttachmentSyncStatus(attachment: TaskAttachment): TaskAttachmentSyncStatus {
  if (attachment.storagePath) return 'remote';
  if (attachment.data) return 'local';
  return 'pending';
}

function normalizeExternalUrl(rawUrl: string, translate: Translate) {
  const value = rawUrl.trim();

  if (!value) {
    throw new Error(translate('attachments.error.emptyLink'));
  }

  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(translate('attachments.error.invalidLinkProtocol'));
  }

  return url.toString();
}

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}
