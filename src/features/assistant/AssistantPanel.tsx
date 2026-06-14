import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/icons';
import { useI18n } from '../../shared/i18n';
import type { ParsedTaskCommand } from './spanishTaskParser';
import { parseTaskCommand } from './taskCommandParser';
import { useVoiceRecognition } from './useVoiceRecognition';

interface AssistantPanelProps {
  onCreateDraft: (parsed: ParsedTaskCommand) => void;
  canWriteTasks?: boolean;
}

export function AssistantPanel({ onCreateDraft, canWriteTasks = true }: AssistantPanelProps) {
  const { language, t } = useI18n();
  const [textCommand, setTextCommand] = useState('');
  const [lastParsed, setLastParsed] = useState<ParsedTaskCommand | null>(null);

  function handleParse(command: string) {
    if (!command.trim()) return;

    const parsed = parseTaskCommand(command, language);
    setLastParsed(parsed);
    if (canWriteTasks) {
      onCreateDraft(parsed);
    }
  }

  const helperText = useMemo(() => {
    if (!lastParsed) {
      return t('assistant.initialHelper');
    }

    if (lastParsed.confidence === 'complete') {
      return lastParsed.summary;
    }

    return `${lastParsed.summary} ${t('app.confirmPrefix', { reasons: lastParsed.confirmationReasons.join(' ') })}`;
  }, [lastParsed, t]);

  return (
    <section className="space-y-5">
      <div className="aura-card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-x-6 bottom-0 h-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="aura-orb h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="aura-label">{t('assistant.local')}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{t('assistant.title')}</h2>
            <p className="aura-muted mt-3 text-sm leading-relaxed">{t('assistant.description')}</p>
          </div>
        </div>
        <div className="relative mt-4 rounded-3xl border border-cyan-500/15 bg-cyan-50/70 p-4 text-sm leading-relaxed text-slate-700 dark:bg-cyan-500/10 dark:text-cyan-100">
          <p>{t('assistant.naturalExample')}</p>
          <p className="mt-3">{t('assistant.guidedExample')}</p>
        </div>
      </div>

      <VoiceCommandButton onTranscript={handleParse} disabled={!canWriteTasks} />

      <div className="aura-card p-5">
        <label className="aura-label" htmlFor="assistant-command">
          {t('assistant.textInput')}
        </label>
        <textarea
          id="assistant-command"
          className="aura-input mt-3 min-h-28 resize-none"
          value={textCommand}
          onChange={(event) => setTextCommand(event.target.value)}
          placeholder={t('assistant.placeholder')}
        />
        <button
          type="button"
          onClick={() => handleParse(textCommand)}
          disabled={!textCommand.trim() || !canWriteTasks}
          className="aura-primary mt-4 w-full"
        >
          {canWriteTasks ? t('assistant.parseAndOpen') : t('sharing.viewerReadonly')}
        </button>
        <p className="aura-muted mt-3 text-sm">{helperText}</p>
      </div>

      {lastParsed ? (
        <div className="aura-card p-5">
          <p className="aura-label">{t('assistant.lastParsed')}</p>
          {lastParsed.confirmationReasons.length ? (
            <div className="aura-alert mt-3 p-3">{lastParsed.confirmationReasons.join(' ')}</div>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <DetectedField label={t('assistant.detected.date')} value={lastParsed.detected.dateLabel ?? lastParsed.draft.date} />
            <div className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">{t('assistant.detected.time')}</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.time}</dd>
              {lastParsed.detected.suggestedTimes?.length ? (
                <dd className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-200">
                  {t('assistant.options', { values: lastParsed.detected.suggestedTimes.join(language === 'en' ? ' or ' : ' o ') })}
                </dd>
              ) : null}
            </div>
            <DetectedField
              className="col-span-2"
              label={t('assistant.detected.title')}
              value={lastParsed.draft.title || t('assistant.pendingTitle')}
            />
            <DetectedField
              label={t('assistant.detected.alarm')}
              value={lastParsed.draft.reminderEnabled ? t('common.enabled') : t('common.disabled')}
            />
            <DetectedField
              label={t('assistant.detected.sound')}
              value={
                !lastParsed.draft.reminderEnabled
                  ? t('common.notApplicable')
                  : lastParsed.draft.reminderSilent
                    ? t('assistant.soundSilent')
                    : t('assistant.soundOn')
              }
            />
            <DetectedField
              className="col-span-2"
              label={t('assistant.detected.minutesBefore')}
              value={lastParsed.draft.reminderEnabled ? `${lastParsed.draft.reminderMinutesBefore}` : t('assistant.noReminder')}
            />
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function DetectedField({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`${className} rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35`}>
      <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">{label}</dt>
      <dd className="mt-1 font-black text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

interface VoiceCommandButtonProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}

export function VoiceCommandButton({ onTranscript, disabled = false }: VoiceCommandButtonProps) {
  const { t } = useI18n();
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState(t('assistant.listenReady'));
  const { startListening } = useVoiceRecognition({ onTranscript });

  useEffect(() => {
    setStatus(t('assistant.listenReady'));
  }, [t]);

  return (
    <div className="aura-card p-5">
      <button
        type="button"
        onClick={() =>
          disabled
            ? undefined
            :
          startListening((message, voiceStatus) => {
            setStatus(message);
            setIsListening(voiceStatus === 'listening');
          })
        }
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-5 text-lg font-black text-white shadow-aura transition hover:scale-[1.01] ${
          isListening ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-blue-600'
        }`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-white/10">
          <Icon name="mic" className="h-7 w-7" />
        </span>
        {disabled ? t('sharing.viewerReadonly') : isListening ? t('assistant.listening') : t('assistant.useMicrophone')}
      </button>
      <p className="aura-muted mt-3 text-sm">{status}</p>
    </div>
  );
}
