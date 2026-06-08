import { useEffect, useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
  type NotificationPermissionState,
} from '../../infrastructure/notifications/browserNotifications';

export function SettingsPanel() {
  const { theme, toggleTheme } = useTheme();
  const [permission, setPermission] = useState<NotificationPermissionState>(() => getNotificationPermission());
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  async function handleRequestPermission() {
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    setTestMessage(nextPermission === 'granted' ? 'Permiso concedido.' : 'No hay permiso para enviar notificaciones.');
  }

  function handleTestNotification() {
    const wasShown = showBrowserNotification('Aura Calendar', 'Notificación de prueba funcionando.', false);
    setTestMessage(
      wasShown ? 'Notificación enviada.' : 'No se pudo enviar. Primero concedé permisos de notificación.',
    );
  }

  return (
    <section className="space-y-5">
      <div className="aura-card p-5">
        <p className="aura-label">Ajustes</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Preferencias locales</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Todo queda en este dispositivo durante la Fase 1. Sin login, sin nube y sin calendarios externos.
        </p>
      </div>

      <div className="aura-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="aura-label">Tema</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              Modo {theme === 'dark' ? 'oscuro' : 'claro'}
            </h3>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            Cambiar
          </button>
        </div>
      </div>

      <div className="aura-card p-5">
        <p className="aura-label">Notificaciones</p>
        <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Estado: {labelFor(permission)}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          En esta fase los recordatorios se programan mientras la PWA está abierta. Si la app está cerrada, Android no
          garantiza ejecución exacta desde el navegador.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleRequestPermission}
            className="rounded-2xl bg-violet-600 px-4 py-3 font-black text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700"
          >
            Solicitar permiso
          </button>
          <button
            type="button"
            onClick={handleTestNotification}
            className="rounded-2xl bg-cyan-500 px-4 py-3 font-black text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-600"
          >
            Probar notificación
          </button>
        </div>

        {testMessage ? <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{testMessage}</p> : null}
      </div>

      <div className="aura-card p-5">
        <p className="aura-label">Futuras fases</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
          <p>• Repeticiones avanzadas y adjuntos.</p>
          <p>• Supabase Auth, Database y Storage.</p>
          <p>• Calendarios compartidos.</p>
          <p>• Capacitor, APK/AAB y notificaciones nativas Android.</p>
        </div>
      </div>
    </section>
  );
}

function labelFor(permission: NotificationPermissionState) {
  if (permission === 'unsupported') return 'no soportado';
  if (permission === 'granted') return 'concedido';
  if (permission === 'denied') return 'bloqueado';
  return 'pendiente';
}
