import { useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
import {
  createFileAttachment,
  createLinkAttachment,
  createNoteAttachment,
  formatAttachmentSize,
  getAttachmentBlob,
  hasLocalAttachmentBlob,
  labelForAttachmentType,
  MAX_ATTACHMENT_SIZE_BYTES,
  removeAttachmentById,
  safeAttachmentFileName,
  type TaskAttachment,
  type TaskAttachmentType,
} from '../../domain/tasks/attachment';
import { createId } from '../../shared/id';
import { Icon, type IconName } from '../../shared/icons';
import { useI18n, type TranslationParams } from '../../shared/i18n';
import { getSupabaseClient } from '../../infrastructure/supabase/supabaseClient';
import { downloadRemoteAttachment } from '../../infrastructure/supabase/supabaseAttachmentRepository';

interface AttachmentEditorProps {
  attachments: TaskAttachment[];
  onChange: (attachments: TaskAttachment[]) => void;
}

type AttachmentMode = 'link' | 'note' | null;

export function AttachmentEditor({ attachments, onChange }: AttachmentEditorProps) {
  const { t } = useI18n();
  const fileInputId = useId();
  const [mode, setMode] = useState<AttachmentMode>(null);
  const [error, setError] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [noteText, setNoteText] = useState('');

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) return;

    const nextAttachments = [...attachments];
    const errors: string[] = [];

    for (const file of files) {
      try {
        nextAttachments.push(createFileAttachment(file, createId(), '', new Date().toISOString(), t));
      } catch (caughtError) {
        errors.push(caughtError instanceof Error ? caughtError.message : t('attachments.addFileError'));
      }
    }

    if (nextAttachments.length !== attachments.length) {
      onChange(nextAttachments);
    }

    setError(errors.join(' '));
  }

  function handleAddLink() {
    try {
      const attachment = createLinkAttachment({
        url: linkUrl,
        title: linkTitle,
        description: linkDescription,
      }, createId(), '', new Date().toISOString(), t);

      onChange([...attachments, attachment]);
      setLinkUrl('');
      setLinkTitle('');
      setLinkDescription('');
      setMode(null);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('attachments.addLinkError'));
    }
  }

  function handleAddNote() {
    try {
      const attachment = createNoteAttachment(noteText, createId(), '', new Date().toISOString(), t);
      onChange([...attachments, attachment]);
      setNoteText('');
      setMode(null);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('attachments.addNoteError'));
    }
  }

  return (
    <section className="aura-card overflow-hidden">
      <div className="border-b border-slate-200/50 p-4 dark:border-slate-800/70">
        <div className="flex items-center gap-3">
          <span className="aura-row-icon">
            <Icon name="attachment" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="aura-label">{t('attachments.title')}</p>
            <p className="aura-muted mt-1 text-xs">
              {t('attachments.description', { maxSize: formatAttachmentSize(MAX_ATTACHMENT_SIZE_BYTES) })}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <label className="aura-secondary cursor-pointer px-3 py-2 text-center text-sm" htmlFor={fileInputId}>
            {t('attachments.file')}
          </label>
          <button type="button" className="aura-secondary px-3 py-2 text-sm" onClick={() => setMode(mode === 'link' ? null : 'link')}>
            {t('attachments.link')}
          </button>
          <button type="button" className="aura-secondary px-3 py-2 text-sm" onClick={() => setMode(mode === 'note' ? null : 'note')}>
            {t('attachments.note')}
          </button>
        </div>

        <input
          id={fileInputId}
          type="file"
          multiple
          className="sr-only"
          accept="image/*,application/pdf,audio/*,video/*,.txt,.csv,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp"
          onChange={handleFiles}
        />

        {mode === 'link' ? (
          <div className="mt-4 space-y-3">
            <input className="aura-input" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder={t('attachments.linkUrlPlaceholder')} />
            <input className="aura-input" value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder={t('attachments.linkTitlePlaceholder')} />
            <textarea
              className="aura-input min-h-20 resize-none"
              value={linkDescription}
              onChange={(event) => setLinkDescription(event.target.value)}
              placeholder={t('attachments.linkDescriptionPlaceholder')}
            />
            <button type="button" className="aura-primary w-full text-sm" onClick={handleAddLink}>
              {t('attachments.addLink')}
            </button>
          </div>
        ) : null}

        {mode === 'note' ? (
          <div className="mt-4 space-y-3">
            <textarea
              className="aura-input min-h-24 resize-none"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder={t('attachments.notePlaceholder')}
            />
            <button type="button" className="aura-primary w-full text-sm" onClick={handleAddNote}>
              {t('attachments.addNote')}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 rounded-2xl border border-amber-300/50 bg-amber-50/90 p-3 text-xs font-bold text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">{error}</p> : null}
      </div>

      <AttachmentList
        attachments={attachments}
        emptyText={t('attachments.empty')}
        onRemove={(id) => onChange(removeAttachmentById(attachments, id))}
      />
    </section>
  );
}

interface AttachmentListProps {
  attachments: TaskAttachment[];
  emptyText?: string;
  compact?: boolean;
  onRemove?: (id: string) => void;
}

export function AttachmentList({ attachments, emptyText, compact = false, onRemove }: AttachmentListProps) {
  if (!attachments.length) {
    return emptyText ? <p className="aura-muted p-4 text-sm">{emptyText}</p> : null;
  }

  return (
    <div className={compact ? 'mt-4 space-y-2' : 'space-y-2 p-4'}>
      {attachments.map((attachment) => (
        <AttachmentCard key={attachment.id} attachment={attachment} compact={compact} onRemove={onRemove} />
      ))}
    </div>
  );
}

function AttachmentCard({ attachment, compact, onRemove }: { attachment: TaskAttachment; compact: boolean; onRemove?: (id: string) => void }) {
  const { t } = useI18n();
  const objectUrl = useObjectUrl(attachment);
  const icon = iconForAttachmentType(attachment.type);
  const [actionError, setActionError] = useState('');

  async function handleOpen() {
    try {
      if (attachment.storagePath) {
        await openRemoteAttachment(attachment, t);
      } else {
        openLocalAttachment(attachment, t);
      }
      setActionError('');
    } catch (caughtError) {
      handleAttachmentActionError(caughtError, setActionError, t);
    }
  }

  async function handleDownload() {
    try {
      if (attachment.storagePath) {
        await downloadRemoteAttachmentFromUi(attachment, t);
      } else {
        downloadLocalAttachment(attachment, t);
      }
      setActionError('');
    } catch (caughtError) {
      handleAttachmentActionError(caughtError, setActionError, t);
    }
  }

  return (
    <article className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
      <div className="flex items-start gap-3">
        <AttachmentVisual attachment={attachment} objectUrl={objectUrl} icon={icon} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">{attachment.name}</p>
              <p className="mt-0.5 text-xs font-bold text-cyan-700/80 dark:text-cyan-200/80">
                {labelForAttachmentType(attachment.type, t)}
                {attachment.size ? ` · ${formatAttachmentSize(attachment.size)}` : ''}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {t(`attachments.status.${attachment.syncStatus ?? (attachment.storagePath ? 'remote' : 'local')}`)}
              </p>
            </div>
            {onRemove ? (
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                onClick={() => onRemove(attachment.id)}
                aria-label={t('attachments.deleteNamed', { name: attachment.name })}
              >
                <Icon name="trash" className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <AttachmentPreview
            attachment={attachment}
            objectUrl={objectUrl}
            compact={compact}
            onOpen={handleOpen}
            onDownload={handleDownload}
          />
          {actionError ? (
            <p className="mt-2 rounded-2xl border border-rose-300/50 bg-rose-50/90 p-3 text-xs font-bold text-rose-900 dark:bg-rose-400/10 dark:text-rose-100">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AttachmentVisual({ attachment, objectUrl, icon }: { attachment: TaskAttachment; objectUrl?: string; icon: IconName }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  if (attachment.type === 'image' && objectUrl && !thumbnailFailed) {
    return <img src={objectUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" onError={() => setThumbnailFailed(true)} />;
  }

  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">
      <Icon name={icon} className="h-7 w-7" />
    </span>
  );
}

function AttachmentPreview({
  attachment,
  objectUrl,
  compact,
  onOpen,
  onDownload,
}: {
  attachment: TaskAttachment;
  objectUrl?: string;
  compact: boolean;
  onOpen: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
}) {
  const { t } = useI18n();

  if (attachment.type === 'link' && attachment.url) {
    return (
      <div className="mt-2">
        <a className="text-sm font-bold text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-200" href={attachment.url} target="_blank" rel="noreferrer">
          {t('attachments.openLink')}
        </a>
        {attachment.text ? <p className="aura-muted mt-1 text-sm">{attachment.text}</p> : null}
      </div>
    );
  }

  if (attachment.type === 'note') {
    return <p className="aura-muted mt-2 whitespace-pre-wrap text-sm">{attachment.text}</p>;
  }

  if (attachment.type === 'audio' && objectUrl) {
    return (
      <>
        <audio className="mt-3 w-full" src={objectUrl} controls preload="metadata" />
        <AttachmentFileActions onOpen={onOpen} onDownload={onDownload} />
      </>
    );
  }

  if (attachment.type === 'video' && objectUrl) {
    return compact ? (
      <AttachmentFileActions onOpen={onOpen} onDownload={onDownload} />
    ) : (
      <>
        <video className="mt-3 max-h-48 w-full rounded-2xl bg-black" src={objectUrl} controls preload="metadata" />
        <AttachmentFileActions onOpen={onOpen} onDownload={onDownload} />
      </>
    );
  }

  if ((attachment.type === 'pdf' || attachment.type === 'document' || attachment.type === 'image') && (hasLocalAttachmentBlob(attachment) || attachment.storagePath)) {
    return <AttachmentFileActions onOpen={onOpen} onDownload={onDownload} />;
  }

  return <p className="aura-muted mt-2 text-xs">{attachment.storagePath ? t('attachments.remotePreviewUnavailable') : t('attachments.previewUnavailable')}</p>;
}

function AttachmentFileActions({ onOpen, onDownload }: { onOpen: () => void | Promise<void>; onDownload: () => void | Promise<void> }) {
  const { t } = useI18n();

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 px-3 py-2 text-xs font-black text-cyan-700 transition hover:border-cyan-400 dark:text-cyan-200"
        onClick={onOpen}
      >
        {t('attachments.open')}
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 px-3 py-2 text-xs font-black text-cyan-700 transition hover:border-cyan-400 dark:text-cyan-200"
        onClick={onDownload}
      >
        <Icon name="download" className="h-4 w-4" />
        {t('attachments.download')}
      </button>
    </div>
  );
}

function useObjectUrl(attachment: TaskAttachment) {
  const localObjectUrl = useMemo(() => {
    const blob = getAttachmentBlob(attachment);
    return blob ? URL.createObjectURL(blob) : undefined;
  }, [attachment.data, attachment.mimeType, attachment.size]);
  const [remoteObjectUrl, setRemoteObjectUrl] = useState<string>();

  useEffect(() => {
    return () => {
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
    };
  }, [localObjectUrl]);

  useEffect(() => {
    if (localObjectUrl || !attachment.storagePath || !canPreviewRemoteInline(attachment.type)) {
      setRemoteObjectUrl(undefined);
      return;
    }

    let isMounted = true;
    let objectUrl: string | undefined;

    downloadRemoteBlob(attachment)
      .then((blob) => {
        if (!isMounted) return;
        objectUrl = URL.createObjectURL(blob);
        setRemoteObjectUrl(objectUrl);
      })
      .catch(() => {
        if (isMounted) setRemoteObjectUrl(undefined);
      });

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.storagePath, attachment.type, localObjectUrl]);

  return localObjectUrl ?? remoteObjectUrl;
}

type Translate = (key: string, params?: TranslationParams) => string;

function openLocalAttachment(attachment: TaskAttachment, t: Translate) {
  const objectUrl = createLocalAttachmentObjectUrl(attachment, t);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    link.remove();
  }, 60_000);
}

function downloadLocalAttachment(attachment: TaskAttachment, t: Translate) {
  const objectUrl = createLocalAttachmentObjectUrl(attachment, t);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = safeAttachmentFileName(attachment.name);
  link.rel = 'noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    link.remove();
  }, 10_000);
}

async function openRemoteAttachment(attachment: TaskAttachment, t: Translate) {
  const objectUrl = URL.createObjectURL(await downloadRemoteBlob(attachment));
  const link = document.createElement('a');

  link.href = objectUrl;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    link.remove();
  }, 60_000);
}

async function downloadRemoteAttachmentFromUi(attachment: TaskAttachment, t: Translate) {
  const objectUrl = URL.createObjectURL(await downloadRemoteBlob(attachment));
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = safeAttachmentFileName(attachment.name);
  link.rel = 'noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    link.remove();
  }, 10_000);
}

async function downloadRemoteBlob(attachment: TaskAttachment) {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('Supabase no configurado.');
  }

  return downloadRemoteAttachment(client, attachment);
}

function createLocalAttachmentObjectUrl(attachment: TaskAttachment, t: Translate) {
  const blob = getAttachmentBlob(attachment);

  if (!blob) {
    throw new Error(t('attachments.localMissing'));
  }

  return URL.createObjectURL(blob);
}

function handleAttachmentActionError(caughtError: unknown, setActionError: (message: string) => void, t: Translate) {
  if (import.meta.env.DEV) {
    console.error('Error técnico al abrir/descargar adjunto.', caughtError);
  }

  setActionError(t('attachments.openError'));
}

function canPreviewRemoteInline(type: TaskAttachmentType) {
  return type === 'image' || type === 'audio' || type === 'video';
}

function iconForAttachmentType(type: TaskAttachmentType): IconName {
  const icons: Record<TaskAttachmentType, IconName> = {
    image: 'image',
    pdf: 'file',
    audio: 'mic',
    video: 'file',
    document: 'file',
    link: 'link',
    note: 'note',
  };

  return icons[type];
}
