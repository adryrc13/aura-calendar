import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/icons';
import { supabaseConfigurationLabel } from '../../infrastructure/supabase/supabaseClient';
import { labelForUser, useSupabaseAuth } from './useSupabaseAuth';

type AuthMode = 'login' | 'register';

export function AccountSyncPanel() {
  const { isConfigured, missingKeys, isLoadingSession, user, signIn, signUp, signOut } = useSupabaseAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  async function handleSignOut() {
    const result = await signOut();
    setStatusMessage(result.message);
  }

  return (
    <>
      <div className="aura-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="aura-label">Cuenta y sincronización</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              Modo local activo
            </h3>
            <p className="aura-muted mt-3 text-sm leading-relaxed">
              Tus tareas siguen funcionando en IndexedDB. La sincronización remota de tareas se activará en la siguiente fase.
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-[0_0_22px_rgba(34,211,238,0.18)] dark:bg-cyan-500/10 dark:text-cyan-200">
            <Icon name="settings" className="h-6 w-6" />
          </span>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <StatusChip label="Persistencia" value="Local activa" tone="ok" />
          <StatusChip label="Supabase" value={supabaseConfigurationLabel()} tone={isConfigured ? 'ok' : 'warn'} />
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

        {statusMessage ? <p className="aura-muted mt-3 text-sm font-semibold">{statusMessage}</p> : null}
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
