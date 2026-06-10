import {
  createLinkAttachment,
  createNoteAttachment,
  detectAttachmentFileType,
  MAX_ATTACHMENT_SIZE_BYTES,
  getAttachmentBlob,
  hasLocalAttachmentBlob,
  normalizeTaskAttachments,
  removeAttachmentById,
  safeAttachmentFileName,
  validateAttachmentFile,
  type AttachmentFileLike,
  type TaskAttachment,
} from './attachment';

function file(name: string, type: string, size = 1024): AttachmentFileLike {
  return { name, type, size };
}

export function runAttachmentInternalTests() {
  const now = '2026-06-10T00:00:00.000Z';
  const image = file('foto.png', 'image/png');
  const link = createLinkAttachment({ url: 'https://example.com/recurso', title: 'Recurso' }, 'link-1', '', now);
  const note = createNoteAttachment('Llevar documentación impresa', 'note-1', '', now);
  const attachments: TaskAttachment[] = [
    {
      id: 'file-1',
      taskId: '',
      type: 'image',
      name: 'foto.png',
      mimeType: 'image/png',
      size: 1024,
      createdAt: now,
      updatedAt: now,
    },
    link,
    note,
  ];

  const normalized = normalizeTaskAttachments(attachments, 'task-1', now);
  const afterDelete = removeAttachmentById(normalized, 'link-1');
  const imageBlob = getAttachmentBlob({
    data: new Blob(['imagen'], { type: 'image/png' }),
    mimeType: 'image/png',
    size: 6,
  });
  const reconstructedDocumentBlob = getAttachmentBlob({
    data: new Uint8Array([1, 2, 3]).buffer as unknown as Blob,
    mimeType: 'application/pdf',
    size: 3,
  });

  const cases = [
    {
      name: 'crear tarea sin adjuntos',
      ok: normalizeTaskAttachments([], 'task-1', now).length === 0,
    },
    {
      name: 'crear tarea con imagen',
      ok: detectAttachmentFileType(image) === 'image' && validateAttachmentFile(image).ok,
    },
    {
      name: 'mantener blob de imagen descargable',
      ok: imageBlob instanceof Blob && imageBlob.type === 'image/png' && imageBlob.size === 6,
    },
    {
      name: 'reconstruir adjunto local desde buffer',
      ok: reconstructedDocumentBlob instanceof Blob && reconstructedDocumentBlob.type === 'application/pdf' && reconstructedDocumentBlob.size === 3,
    },
    {
      name: 'rechazar archivo mayor a 10 MB',
      ok: !validateAttachmentFile(file('grande.pdf', 'application/pdf', MAX_ATTACHMENT_SIZE_BYTES + 1)).ok,
    },
    {
      name: 'crear tarea con link',
      ok: link.type === 'link' && link.url === 'https://example.com/recurso' && link.name === 'Recurso',
    },
    {
      name: 'crear tarea con nota',
      ok: note.type === 'note' && note.text === 'Llevar documentación impresa',
    },
    {
      name: 'eliminar adjunto',
      ok: afterDelete.length === 2 && afterDelete.every((attachment) => attachment.id !== 'link-1'),
    },
    {
      name: 'editar tarea manteniendo adjuntos',
      ok: normalized.length === 3 && normalized.every((attachment) => attachment.taskId === 'task-1'),
    },
    {
      name: 'detectar adjunto local disponible',
      ok: hasLocalAttachmentBlob({ data: imageBlob, mimeType: 'image/png', size: 6 }),
    },
    {
      name: 'sanitizar nombre de descarga',
      ok: safeAttachmentFileName('a/b:c?.png') === 'a-b-c-.png',
    },
    {
      name: 'rechazar tipo no soportado',
      ok: !validateAttachmentFile(file('instalador.exe', 'application/x-msdownload')).ok,
    },
  ];

  return cases;
}
