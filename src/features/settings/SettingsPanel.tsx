import { useEffect, useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Icon } from '../../shared/icons';
import { useI18n, type Language } from '../../shared/i18n';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
  type NotificationPermissionState,
} from '../../infrastructure/notifications/browserNotifications';
import { AccountSyncPanel } from './AccountSyncPanel';

export function SettingsPanel() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const [permission, setPermission] = useState<NotificationPermissionState>(() => getNotificationPermission());
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  async function handleRequestPermission() {
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    setTestMessage(nextPermission === 'granted' ? t('settings.permissionGranted') : t('settings.permissionDenied'));
  }

  function handleTestNotification() {
    const wasShown = showBrowserNotification('Aura Calendar', t('settings.testNotificationBody'), false);
    setTestMessage(wasShown ? t('settings.testNotificationSent') : t('settings.testNotificationFailed'));
  }

  return (
    <section className="space-y-5">
      <div className="aura-card p-5">
        <p className="aura-label">{t('settings.title')}</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{t('settings.heading')}</h2>
        <p className="aura-muted mt-3 text-sm leading-relaxed">{t('settings.description')}</p>
      </div>

      <AccountSyncPanel />

      <div className="aura-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="aura-label">{t('language.title')}</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {language === 'en' ? t('language.english') : t('language.spanish')}
            </h3>
            <p className="aura-muted mt-2 text-sm leading-relaxed">{t('language.description')}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <LanguageButton value="es" current={language} onSelect={setLanguage} label={t('language.spanish')} />
          <LanguageButton value="en" current={language} onSelect={setLanguage} label={t('language.english')} />
        </div>
      </div>

      <div className="aura-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="aura-label">{t('settings.theme')}</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {t('settings.mode', { mode: theme })}
            </h3>
          </div>
          <button type="button" onClick={toggleTheme} className="aura-secondary flex items-center gap-2">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
            {t('settings.changeTheme')}
          </button>
        </div>
      </div>

      <div className="aura-card p-5">
        <p className="aura-label">{t('settings.notifications')}</p>
        <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
          {t('settings.notificationStatus', { status: labelFor(permission, t) })}
        </h3>
        <p className="aura-muted mt-3 text-sm leading-relaxed">{t('settings.notificationsDescription')}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={handleRequestPermission} className="aura-primary">
            {t('settings.requestPermission')}
          </button>
          <button type="button" onClick={handleTestNotification} className="aura-primary">
            {t('settings.testNotification')}
          </button>
        </div>

        {testMessage ? <p className="aura-muted mt-3 text-sm font-semibold">{testMessage}</p> : null}
      </div>

      <div className="aura-card p-5">
        <p className="aura-label">{t('settings.futurePhases')}</p>
        <div className="aura-muted mt-3 grid gap-2 text-sm">
          <p>{t('settings.future.recurrencesAttachments')}</p>
          <p>{t('settings.future.storage')}</p>
          <p>{t('settings.future.sharedCalendars')}</p>
          <p>{t('settings.future.native')}</p>
        </div>
      </div>
    </section>
  );
}

function LanguageButton({
  value,
  current,
  label,
  onSelect,
}: {
  value: Language;
  current: Language;
  label: string;
  onSelect: (language: Language) => void;
}) {
  const isActive = value === current;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
        isActive
          ? 'border-cyan-300 bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
          : 'border-cyan-500/10 bg-white/60 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-cyan-500/10'
      }`}
    >
      {label}
    </button>
  );
}

function labelFor(permission: NotificationPermissionState, t: (key: string) => string) {
  if (permission === 'unsupported') return t('settings.permission.unsupported');
  if (permission === 'granted') return t('settings.permission.granted');
  if (permission === 'denied') return t('settings.permission.denied');
  return t('settings.permission.default');
}
