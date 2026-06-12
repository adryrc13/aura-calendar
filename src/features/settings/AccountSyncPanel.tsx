import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../shared/icons';
import { supabaseConfigurationLabel } from '../../infrastructure/supabase/supabaseClient';
import {
  activateRemoteTaskSync,
  ensureDefaultRemoteCalendar,
  migrateLocalTasksToSupabase,
  type TaskMigrationSummary,
} from '../../infrastructure/supabase/supabaseTaskRepository';
import {
  getTaskRepositoryMode,
  setTaskRepositoryMode,
  subscribeTaskRepositoryModeChange,
  type TaskRepositoryMode,
} from '../../infrastructure/tasks/taskRepositoryProvider';
import { labelForUser, useSupabaseAuth } from './useSupabaseAuth';

type AuthMode = 'login' | 'register';

export function AccountSyncPanel() {
  const { isConfigured, missingKeys, isLoadingSession, user, signIn, signUp, signOut } = useSupabaseAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [repositoryMode, setRepositoryMode] = useState<TaskRepositoryMode>(() => getTaskRepositoryMode());
  const [statusMessage, setStatusMessage] = useState('');
  const [migrationSummary, setMigrationSummary] = useState<TaskMigrationSummary | null>(null);
  const [isSyncActionRunning, setIsSyncActionRunning] = useState(false);

  useEffect(() => subscribeTaskRepositoryModeChange(setRepositoryMode), []);

  async function handleSignOut() {
    const result = await signOut();
    setStatusMessage(result.message);

    if (result.ok) {
      setTaskRepositoryMode('local');
      setMigrationSummary(null);
    }
  }

  async function handleActivateRemoteSync() {
    setMigrationSummary(null);

    if (!isConfigured) {
      setStatusMessage(`Supabase no configurado. Faltan: ${missingKeys.join(', ')}.`);
      return;
    }

    if (!user) {
      setStatusMessage('Iniciá sesión antes de activar la sincronización remota.');
      return;
    }

    setIsSyncActionRunning(true);

    try {
      const calendar = await activateRemoteTaskSync();
      setTaskRepositoryMode('remote');
      setStatusMessage(`Sincronización remota activa. Calendario remoto: ${calendar.name}.`);
    } catch (error) {
      setTaskRepositoryMode('local');
      setStatusMessage(`${errorMessage(error)} Volvimos a modo local para no perder datos.`);
    } finally {
      setIsSyncActionRunning(false);
    }
  }

  async function handleMigrateLocalTasks() {
    setMigrationSummary(null);

    if (!isConfigured) {
      setStatusMessage(`Supabase no configurado. Faltan: ${missingKeys.join(', ')}.`);
      return;
    }

    if (!user) {
      setStatusMessage('Iniciá sesión antes de migrar tareas locales a Supabase.');
      return;
    }

    setIsSyncActionRunning(true);

    try {
      await ensureDefaultRemoteCalendar();
      const summary = await migrateLocalTasksToSupabase();
      setMigrationSummary(summary);
      setStatusMessage('Migración local → Supabase terminada. Las tareas locales siguen en este dispositivo.');
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
    setStatusMessage('Modo local activo. Tus tareas se guardan solo en este dispositivo.');
  }

  const remoteAvailable = isConfigured && Boolean(user);
  const currentStateLabel = repositoryMode === 'remote' ? 'Sincronización remota activa' : 'Modo local';

  return (
    <>
      <div className="aura-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="aura-label">Cuenta y sincronización</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {currentStateLabel}
            </h3>
            <p className="aura-muted mt-3 text-sm leading-relaxed">
              Dexie sigue disponible como respaldo local. Si activás Supabase, las tareas se leen y escriben contra Database;
              si algo falla, podés volver a usar solo este dispositivo.
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-[0_0_22px_rgba(34,211,238,0.18)] dark:bg-cyan-500/10 dark:text-cyan-200">
            <Icon name="settings" className="h-6 w-6" />
          </span>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <StatusChip label="Estado" value={currentStateLabel} tone={repositoryMode === 'remote' ? 'ok' : 'neutral'} />
          <StatusChip
            label="Supabase"
            value={remoteAvailable ? 'Sincronización remota disponible' : supabaseConfigurationLabel()}
            tone={remoteAvailable ? 'ok' : isConfigured ? 'neutral' : 'warn'}
          />
          <StatusChip label="Usuario" value={isLoadingSession ? 'Comprobando…' : labelForUser(user)} tone={user ? 'ok' : 'neutral'} />
        </div>

        {!isConfigured ? (
          <p className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/90 p-3 text-xs font-bold text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
            Supabase no configurado. Faltan: {missingKeys.join(', ')}. La app sigue funcionando en modo local.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="aura-secondary"
            onClick={() => setAuthMode('login')}
            disabled={!isConfigured}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className="aura-primary"
            onClick={() => setAuthMode('register')}
            disabled={!isConfigured}
          >
            Registrarse
          </button>
          <button
            type="button"
            className="aura-danger"
            onClick={handleSignOut}
            disabled={!isConfigured || !user}
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="aura-primary"
            onClick={handleActivateRemoteSync}
            disabled={!remoteAvailable || isSyncActionRunning}
          >
            Activar sincronización remota
          </button>
          <button
            type="button"
            className="aura-secondary"
            onClick={handleMigrateLocalTasks}
            disabled={!remoteAvailable || isSyncActionRunning}
          >
            Migrar tareas locales a Supabase
          </button>
          <button
            type="button"
            className="aura-secondary"
            onClick={handleUseLocalOnly}
            disabled={repositoryMode === 'local' || isSyncActionRunning}
          >
            Usar solo este dispositivo
          </button>
        </div>

        <p className="aura-muted mt-3 text-xs font-semibold">
          Los adjuntos locales no se suben todavía. Los adjuntos se sincronizarán en la Fase 4C.
        </p>

        {statusMessage ? <p className="aura-muted mt-3 text-sm font-semibold">{statusMessage}</p> : null}

        {migrationSummary ? <MigrationSummary summary={migrationSummary} /> : null}
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
  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/40 bg-cyan-50/70 p-3 text-xs font-bold text-cyan-950 dark:bg-cyan-500/10 dark:text-cyan-100">
      <p>Tareas encontradas: {summary.tasksFound}</p>
      <p>Tareas subidas: {summary.tasksUploaded}</p>
      <p>Tareas omitidas por duplicado: {summary.tasksSkipped}</p>
      <p>Errores: {summary.errors.length}</p>
      {summary.tasksWithLocalAttachments ? <p>Tareas con adjuntos locales: {summary.tasksWithLocalAttachments}</p> : null}
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

function AuthDialog({
  mode,
  onClose,
  onSubmit,
}: {
  mode: AuthMode;
  onClose: () => void;
  onSubmit: (input: { email: string; password: string; fullName?: string }) => Promise<{ ok: boolean; message: string }>;
}) {
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
            <p className="aura-label">Supabase Auth</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="aura-icon-button" aria-label="Cerrar acceso">
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {isRegister ? (
            <div>
              <label className="aura-label" htmlFor="supabase-full-name">
                Nombre opcional
              </label>
              <input
                id="supabase-full-name"
                className="aura-input mt-2"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Tu nombre"
              />
            </div>
          ) : null}

          <div>
            <label className="aura-label" htmlFor="supabase-email">
              Email
            </label>
            <input
              id="supabase-email"
              className="aura-input mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="aura-label" htmlFor="supabase-password">
              Contraseña
            </label>
            <input
              id="supabase-password"
              className="aura-input mt-2"
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          {message ? <p className="aura-muted text-sm font-semibold">{message}</p> : null}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="aura-secondary min-w-28">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="aura-primary flex-1">
              {isSubmitting ? 'Procesando…' : isRegister ? 'Registrarse' : 'Entrar'}
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
