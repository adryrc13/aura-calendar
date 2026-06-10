import { useMemo, useState } from 'react';
import { Icon } from '../../shared/icons';
import { parseSpanishTaskCommand, type ParsedTaskCommand } from './spanishTaskParser';
import { useVoiceRecognition } from './useVoiceRecognition';

interface AssistantPanelProps {
  onCreateDraft: (parsed: ParsedTaskCommand) => void;
}

export function AssistantPanel({ onCreateDraft }: AssistantPanelProps) {
  const [textCommand, setTextCommand] = useState('');
  const [lastParsed, setLastParsed] = useState<ParsedTaskCommand | null>(null);

  function handleParse(command: string) {
    if (!command.trim()) return;

    const parsed = parseSpanishTaskCommand(command);
    setLastParsed(parsed);
    onCreateDraft(parsed);
  }

  const helperText = useMemo(() => {
    if (!lastParsed) {
      return 'Escribí o dictá una frase: el parser es local, no usa IA externa y siempre abre el formulario para revisar.';
    }

    if (lastParsed.confidence === 'complete') {
      return lastParsed.summary;
    }

    return `${lastParsed.summary} Confirmá: ${lastParsed.confirmationReasons.join(' ')}`;
  }, [lastParsed]);

  return (
    <section className="space-y-5">
      <div className="aura-card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-x-6 bottom-0 h-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="aura-orb h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="aura-label">Asistente local</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">¿Qué necesitas planear hoy?</h2>
            <p className="aura-muted mt-3 text-sm leading-relaxed">
              No conversa y no usa IA externa. Solo toma una frase, la pasa por un parser local en español y prepara una tarea.
            </p>
          </div>
        </div>
        <div className="relative mt-4 rounded-3xl border border-cyan-500/15 bg-cyan-50/70 p-4 text-sm leading-relaxed text-slate-700 dark:bg-cyan-500/10 dark:text-cyan-100">
          <p>
            Puedes dictar de forma natural: ‘2 de agosto a las 18:00 dentista en Cádiz con alarma’.
          </p>
          <p className="mt-3">
            Para más precisión usa el modo guiado: ‘Tarea: dentista en Cádiz. Fecha: 2 de agosto. Hora: 18:00.
            Alarma: sí.’
          </p>
        </div>
      </div>

      <VoiceCommandButton onTranscript={handleParse} />

      <div className="aura-card p-5">
        <label className="aura-label" htmlFor="assistant-command">
          Entrada por texto
        </label>
        <textarea
          id="assistant-command"
          className="aura-input mt-3 min-h-28 resize-none"
          value={textCommand}
          onChange={(event) => setTextCommand(event.target.value)}
          placeholder="2 de agosto a las 18:00 dentista en Cádiz con alarma"
        />
        <button
          type="button"
          onClick={() => handleParse(textCommand)}
          disabled={!textCommand.trim()}
          className="aura-primary mt-4 w-full"
        >
          Interpretar y abrir formulario
        </button>
        <p className="aura-muted mt-3 text-sm">{helperText}</p>
      </div>

      {lastParsed ? (
        <div className="aura-card p-5">
          <p className="aura-label">Última interpretación</p>
          {lastParsed.confirmationReasons.length ? (
            <div className="aura-alert mt-3 p-3">
              {lastParsed.confirmationReasons.join(' ')}
            </div>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">Fecha</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {lastParsed.detected.dateLabel ?? lastParsed.draft.date}
              </dd>
            </div>
            <div className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">Hora</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.time}</dd>
              {lastParsed.detected.suggestedTimes?.length ? (
                <dd className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-200">
                  Opciones: {lastParsed.detected.suggestedTimes.join(' o ')}
                </dd>
              ) : null}
            </div>
            <div className="col-span-2 rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">Título</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.title || 'Pendiente'}</dd>
            </div>
            <div className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">Alarma</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {lastParsed.draft.reminderEnabled ? 'Activada' : 'Desactivada'}
              </dd>
            </div>
            <div className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">Sonido</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {!lastParsed.draft.reminderEnabled
                  ? 'No aplica'
                  : lastParsed.draft.reminderSilent
                    ? 'Silencioso'
                    : 'Activado'}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-cyan-500/10 bg-white/60 p-3 dark:bg-slate-950/35">
              <dt className="font-bold text-cyan-700/80 dark:text-cyan-200/80">Minutos antes</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {lastParsed.draft.reminderEnabled ? lastParsed.draft.reminderMinutesBefore : 'Sin recordatorio'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}

interface VoiceCommandButtonProps {
  onTranscript: (transcript: string) => void;
}

export function VoiceCommandButton({ onTranscript }: VoiceCommandButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Listo para escuchar si tu navegador soporta Web Speech API.');
  const { startListening } = useVoiceRecognition({ onTranscript });

  return (
    <div className="aura-card p-5">
      <button
        type="button"
        onClick={() =>
          startListening((message, voiceStatus) => {
            setStatus(message);
            setIsListening(voiceStatus === 'listening');
          })
        }
        className={`flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-5 text-lg font-black text-white shadow-aura transition hover:scale-[1.01] ${
          isListening ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-blue-600'
        }`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-white/10">
          <Icon name="mic" className="h-7 w-7" />
        </span>
        {isListening ? 'Escuchando' : 'Usar micrófono'}
      </button>
      <p className="aura-muted mt-3 text-sm">{status}</p>
    </div>
  );
}
