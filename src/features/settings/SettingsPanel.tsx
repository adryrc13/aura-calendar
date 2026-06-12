import { useEffect, useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Icon } from '../../shared/icons';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
  type NotificationPermissionState,
} from '../../infrastructure/notifications/browserNotifications';
import { AccountSyncPanel } from './AccountSyncPanel';

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
        <p className="aura-muted mt-3 text-sm leading-relaxed">
          Todo sigue funcionando en este dispositivo. Supabase queda disponible de forma opcional para usuarios y sincronización.
        </p>
      </div>

      <AccountSyncPanel />

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
            className="aura-secondary flex items-center gap-2"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
            Cambiar
          </button>
        </div>
      </div>

      <div className="aura-card p-5">
        <p className="aura-label">Notificaciones</p>
        <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Estado: {labelFor(permission)}</h3>
        <p className="aura-muted mt-3 text-sm leading-relaxed">
          En esta fase los recordatorios se programan mientras la PWA está abierta. Si la app está cerrada, Android no
          garantiza ejecución exacta desde el navegador.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleRequestPermission}
            className="aura-primary"
          >
            Solicitar permiso
          </button>
          <button
            type="button"
            onClick={handleTestNotification}
            className="aura-primary"
          >
            Probar notificación
          </button>
        </div>

        {testMessage ? <p className="aura-muted mt-3 text-sm font-semibold">{testMessage}</p> : null}
      </div>

      <div className="aura-card p-5">
        <p className="aura-label">Futuras fases</p>
        <div className="aura-muted mt-3 grid gap-2 text-sm">
          <p>• Repeticiones avanzadas y adjuntos.</p>
          <p>• Supabase Storage remoto de adjuntos.</p>
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
