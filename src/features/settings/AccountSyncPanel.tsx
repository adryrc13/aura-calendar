import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../shared/icons';
import { useI18n } from '../../shared/i18n';
import {
  activateRemoteTaskSync,
  ensureDefaultRemoteCalendar,
  migrateLocalAttachmentsToSupabase,
  migrateLocalTasksToSupabase,
  type AttachmentMigrationSummary,
  type TaskMigrationSummary,
} from '../../infrastructure/supabase/supabaseTaskRepository';
import {
  getTaskRepositoryMode,
  setTaskRepositoryMode,
  subscribeTaskRepositoryModeChange,
  type TaskRepositoryMode,
} from '../../infrastructure/tasks/taskRepositoryProvider';
import { useSupabaseAuth } from './useSupabaseAuth';

type AuthMode = 'login' | 'register';

export function AccountSyncPanel() {
  const { t } = useI18n();
  const { isConfigured, missingKeys, isLoadingSession, user, signIn, signUp, signOut } = useSupabaseAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [repositoryMode, setRepositoryMode] = useState<TaskRepositoryMode>(() => getTaskRepositoryMode());
  const [statusMessage, setStatusMessage] = useState('');
  const [migrationSummary, setMigrationSummary] = useState<TaskMigrationSummary | null>(null);
  const [attachmentMigrationSummary, setAttachmentMigrationSummary] = useState<AttachmentMigrationSummary | null>(null);
  const [isSyncActionRunning, setIsSyncActionRunning] = useState(false);

  useEffect(() => subscribeTaskRepositoryModeChange(setRepositoryMode), []);

  async function handleSignOut() {
    const result = await signOut();
    setStatusMessage(result.message);

    if (result.ok) {
      setTaskRepositoryMode('local');
      setMigrationSummary(null);
      setAttachmentMigrationSummary(null);
    }
  }

  async function handleActivateRemoteSync() {
    setMigrationSummary(null);
    setAttachmentMigrationSummary(null);

    if (!isConfigured) {
      setStatusMessage(t('sync.missingSupabaseShort', { keys: missingKeys.join(', ') }));
      return;
    }

    if (!user) {
      setStatusMessage(t('sync.loginRequiredRemote'));
      return;
    }

    setIsSyncActionRunning(true);

    try {
      const calendar = await activateRemoteTaskSync();
      setTaskRepositoryMode('remote');
      setStatusMessage(t('sync.remoteActivated', { name: calendar.name }));
    } catch (error) {
      setTaskRepositoryMode('local');
      setStatusMessage(t('sync.remoteFallbackLocal', { error: errorMessage(error) }));
    } finally {
      setIsSyncActionRunning(false);
    }
  }

  async function handleMigrateLocalTasks() {
    setMigrationSummary(null);
    setAttachmentMigrationSummary(null);

    if (!isConfigured) {
      setStatusMessage(t('sync.missingSupabaseShort', { keys: missingKeys.join(', ') }));
      return;
    }

    if (!user) {
      setStatusMessage(t('sync.loginRequiredMigration'));
      return;
    }

    setIsSyncActionRunning(true);

    try {
      await ensureDefaultRemoteCalendar();
      const summary = await migrateLocalTasksToSupabase();
      setMigrationSummary(summary);
      setStatusMessage(t('sync.migrationDone'));
      if (repositoryMode === 'remote') {
        setTaskRepositoryMode('remote');
      }
    } catch (error) {
      setStatusMessage(errorMessage(error));
    } finally {
      setIsSyncActionRunning(false);
    }
  }

  function handleUseLocalOnly() {
    setTaskRepositoryMode('local');
    setStatusMessage(t('sync.localOnlyActive'));
  }

  async function handleMigrateLocalAttachments() {
    setMigrationSummary(null);
    setAttachmentMigrationSummary(null);

    if (!isConfigured) {
      setStatusMessage(t('sync.missingSupabaseShort', { keys: missingKeys.join(', ') }));
      return;
    }

    if (!user) {
      setStatusMessage(t('sync.loginRequiredMigration'));
      return;
    }

    if (repositoryMode !== 'remote') {
      setStatusMessage(t('sync.remoteRequiredAttachments'));
      return;
    }

    setIsSyncActionRunning(true);

    try {
      const summary = await migrateLocalAttachmentsToSupabase();
      setAttachmentMigrationSummary(summary);
      setStatusMessage(summary.tasksWithoutRemote ? t('sync.attachmentsMigration.tasksFirst') : t('sync.attachmentsMigrationDone'));
    } catch (error) {
      setStatusMessage(errorMessage(error));
    } finally {
      setIsSyncActionRunning(false);
    }
  }

  const remoteAvailable = isConfigured && Boolean(user);
  const currentStateLabel = repositoryMode === 'remote' ? t('sync.remoteActive') : t('sync.localMode');
  const supabaseLabel = remoteAvailable
    ? t('sync.remoteAvailable')
    : isConfigured
      ? t('sync.supabaseConfigured')
      : t('sync.supabaseNotConfigured');

  return (
    <>
      <div className="aura-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="aura-label">{t('sync.title')}</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{currentStateLabel}</h3>
            <p className="aura-muted mt-3 text-sm leading-relaxed">{t('sync.description')}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-[0_0_22px_rgba(34,211,238,0.18)] dark:bg-cyan-500/10 dark:text-cyan-200">
            <Icon name="settings" className="h-6 w-6" />
          </span>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <StatusChip label={t('sync.status')} value={currentStateLabel} tone={repositoryMode === 'remote' ? 'ok' : 'neutral'} />
          <StatusChip label={t('sync.supabase')} value={supabaseLabel} tone={remoteAvailable ? 'ok' : isConfigured ? 'neutral' : 'warn'} />
          <StatusChip label={t('sync.user')} value={isLoadingSession ? t('sync.checking') : user?.email ?? t('sync.notConnected')} tone={user ? 'ok' : 'neutral'} />
          <StatusChip label={t('sync.remoteAttachments')} value={t('sync.remoteAttachmentsAvailable')} tone={remoteAvailable ? 'ok' : 'neutral'} />
        </div>

        {!isConfigured ? (
          <p className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/90 p-3 text-xs font-bold text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
            {t('sync.missingSupabase', { keys: missingKeys.join(', ') })}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button type="button" className="aura-secondary" onClick={() => setAuthMode('login')} disabled={!isConfigured}>
            {t('sync.signIn')}
          </button>
          <button type="button" className="aura-primary" onClick={() => setAuthMode('register')} disabled={!isConfigured}>
            {t('sync.register')}
          </button>
          <button type="button" className="aura-danger" onClick={handleSignOut} disabled={!isConfigured || !user}>
            {t('sync.signOut')}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <button type="button" className="aura-primary" onClick={handleActivateRemoteSync} disabled={!remoteAvailable || isSyncActionRunning}>
            {t('sync.enableRemote')}
          </button>
          <button type="button" className="aura-secondary" onClick={handleMigrateLocalTasks} disabled={!remoteAvailable || isSyncActionRunning}>
            {t('sync.migrateLocal')}
          </button>
          <button type="button" className="aura-secondary" onClick={handleMigrateLocalAttachments} disabled={!remoteAvailable || isSyncActionRunning}>
            {t('sync.migrateLocalAttachments')}
          </button>
          <button type="button" className="aura-secondary" onClick={handleUseLocalOnly} disabled={repositoryMode === 'local' || isSyncActionRunning}>
            {t('sync.useLocalOnly')}
          </button>
        </div>

        <p className="aura-muted mt-3 text-xs font-semibold">{t('sync.remoteAttachmentsNote')}</p>

        {statusMessage ? <p className="aura-muted mt-3 text-sm font-semibold">{statusMessage}</p> : null}

        {migrationSummary ? <MigrationSummary summary={migrationSummary} /> : null}
        {attachmentMigrationSummary ? <AttachmentMigrationSummaryView summary={attachmentMigrationSummary} /> : null}
      </div>

      {authMode ? (
        <AuthDialog
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSubmit={async (input) => {
            const result = authMode === 'login' ? await signIn(input.email, input.password) : await signUp(input);
            setStatusMessage(result.message);
            if (result.ok) setAuthMode(null);
            return result;
          }}
        />
      ) : null}
    </>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'neutral' }) {
  const toneClassName =
    tone === 'ok'
      ? 'border-cyan-300/50 bg-cyan-50/80 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-100'
      : tone === 'warn'
        ? 'border-amber-300/50 bg-amber-50/80 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100'
        : 'border-slate-300/50 bg-white/60 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/40 dark:text-slate-200';

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClassName}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 truncate text-xs font-black">{value}</p>
    </div>
  );
}

function MigrationSummary({ summary }: { summary: TaskMigrationSummary }) {
  const { t } = useI18n();

  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/40 bg-cyan-50/70 p-3 text-xs font-bold text-cyan-950 dark:bg-cyan-500/10 dark:text-cyan-100">
      <p>{t('sync.migration.found', { count: summary.tasksFound })}</p>
      <p>{t('sync.migration.uploaded', { count: summary.tasksUploaded })}</p>
      <p>{t('sync.migration.skipped', { count: summary.tasksSkipped })}</p>
      <p>{t('sync.migration.errors', { count: summary.errors.length })}</p>
      {summary.tasksWithLocalAttachments ? <p>{t('sync.migration.withAttachments', { count: summary.tasksWithLocalAttachments })}</p> : null}
      <p>{summary.note}</p>
      {summary.errors.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {summary.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AttachmentMigrationSummaryView({ summary }: { summary: AttachmentMigrationSummary }) {
  const { t } = useI18n();

  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/40 bg-cyan-50/70 p-3 text-xs font-bold text-cyan-950 dark:bg-cyan-500/10 dark:text-cyan-100">
      <p>{t('sync.attachmentsMigration.found', { count: summary.attachmentsFound })}</p>
      <p>{t('sync.attachmentsMigration.uploaded', { count: summary.attachmentsUploaded })}</p>
      <p>{t('sync.attachmentsMigration.skipped', { count: summary.attachmentsSkipped })}</p>
      <p>{t('sync.attachmentsMigration.errors', { count: summary.errors.length })}</p>
      {summary.tasksWithoutRemote ? <p>{t('sync.attachmentsMigration.tasksWithoutRemote', { count: summary.tasksWithoutRemote })}</p> : null}
      {summary.errors.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {summary.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AuthDialog({
  mode,
  onClose,
  onSubmit,
}: {
  mode: AuthMode;
  onClose: () => void;
  onSubmit: (input: { email: string; password: string; fullName?: string }) => Promise<{ ok: boolean; message: string }>;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === 'register';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await onSubmit({ email, password, fullName });
    setIsSubmitting(false);
    setMessage(result.message);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-3 backdrop-blur-md sm:place-items-center">
      <section className="aura-panel w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="aura-label">{t('sync.authTitle')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {isRegister ? t('sync.createAccount') : t('sync.signIn')}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="aura-icon-button" aria-label={t('sync.closeAccess')}>
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {isRegister ? (
            <div>
              <label className="aura-label" htmlFor="supabase-full-name">
                {t('sync.fullNameOptional')}
              </label>
              <input
                id="supabase-full-name"
                className="aura-input mt-2"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={t('sync.fullNamePlaceholder')}
              />
            </div>
          ) : null}

          <div>
            <label className="aura-label" htmlFor="supabase-email">
              {t('sync.email')}
            </label>
            <input
              id="supabase-email"
              className="aura-input mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('sync.emailPlaceholder')}
              required
            />
          </div>

          <div>
            <label className="aura-label" htmlFor="supabase-password">
              {t('sync.password')}
            </label>
            <input
              id="supabase-password"
              className="aura-input mt-2"
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('sync.passwordPlaceholder')}
              required
            />
          </div>

          {message ? <p className="aura-muted text-sm font-semibold">{message}</p> : null}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="aura-secondary min-w-28">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="aura-primary flex-1">
              {isSubmitting ? t('common.processing') : isRegister ? t('sync.register') : t('sync.enter')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
