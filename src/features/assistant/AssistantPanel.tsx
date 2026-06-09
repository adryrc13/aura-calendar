import { useMemo, useState } from 'react';
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
      <div className="aura-card p-5">
        <p className="aura-label">Asistente local</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Instrucciones a tareas</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          No conversa y no usa IA externa. Solo toma una frase, la pasa por un parser local en español y prepara una tarea.
        </p>
        <div className="mt-4 rounded-3xl bg-violet-50 p-4 text-sm leading-relaxed text-violet-900 dark:bg-violet-500/10 dark:text-violet-100">
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
          className="mt-4 w-full rounded-2xl bg-violet-600 px-4 py-3 font-black text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Interpretar y abrir formulario
        </button>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{helperText}</p>
      </div>

      {lastParsed ? (
        <div className="aura-card p-5">
          <p className="aura-label">Última interpretación</p>
          {lastParsed.confirmationReasons.length ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {lastParsed.confirmationReasons.join(' ')}
            </div>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Fecha</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {lastParsed.detected.dateLabel ?? lastParsed.draft.date}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Hora</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.time}</dd>
              {lastParsed.detected.suggestedTimes?.length ? (
                <dd className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-200">
                  Opciones: {lastParsed.detected.suggestedTimes.join(' o ')}
                </dd>
              ) : null}
            </div>
            <div className="col-span-2 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Título</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.title || 'Pendiente'}</dd>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Alarma</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {lastParsed.draft.reminderEnabled ? 'Activada' : 'Desactivada'}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Sonido</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">
                {!lastParsed.draft.reminderEnabled
                  ? 'No aplica'
                  : lastParsed.draft.reminderSilent
                    ? 'Desactivado'
                    : 'Activado'}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Minutos antes</dt>
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
        className={`flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-5 text-lg font-black text-white shadow-aura transition ${
          isListening ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-600 to-cyan-500 hover:scale-[1.01]'
        }`}
      >
        <span aria-hidden="true">🎙️</span>
        {isListening ? 'Escuchando' : 'Usar micrófono'}
      </button>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{status}</p>
    </div>
  );
}
