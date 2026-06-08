import { useMemo, useState } from 'react';
import type { TaskDraft } from '../../domain/tasks/task';
import { parseSpanishTaskCommand, type ParsedTaskCommand } from './spanishTaskParser';
import { useVoiceRecognition } from './useVoiceRecognition';

interface AssistantPanelProps {
  onCreateDraft: (draft: Partial<TaskDraft> & Pick<TaskDraft, 'date' | 'time'>) => void;
}

export function AssistantPanel({ onCreateDraft }: AssistantPanelProps) {
  const [textCommand, setTextCommand] = useState('');
  const [lastParsed, setLastParsed] = useState<ParsedTaskCommand | null>(null);

  function handleParse(command: string) {
    const parsed = parseSpanishTaskCommand(command);
    setLastParsed(parsed);
    onCreateDraft(parsed.draft);
  }

  const helperText = useMemo(() => {
    if (!lastParsed) {
      return 'Escribí o dictá algo como “mañana a las 9 tomar medicación con alarma”.';
    }

    if (lastParsed.confidence === 'complete') {
      return 'El parser encontró título, fecha y hora. Revisá el formulario antes de guardar.';
    }

    return `Falta completar: ${lastParsed.missing.join(', ')}. Te abrí el formulario con valores propuestos.`;
  }, [lastParsed]);

  return (
    <section className="space-y-5">
      <div className="aura-card p-5">
        <p className="aura-label">Asistente local</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Instrucciones a tareas</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          No conversa y no usa IA externa. Solo toma una frase, la pasa por un parser local en español y prepara una tarea.
        </p>
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
          placeholder="mañana a las 9 tomar medicación con alarma"
        />
        <button
          type="button"
          onClick={() => handleParse(textCommand)}
          disabled={!textCommand.trim()}
          className="mt-4 w-full rounded-2xl bg-violet-600 px-4 py-3 font-black text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Interpretar y crear
        </button>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{helperText}</p>
      </div>

      {lastParsed ? (
        <div className="aura-card p-5">
          <p className="aura-label">Última interpretación</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Fecha</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.date}</dd>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Hora</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.time}</dd>
            </div>
            <div className="col-span-2 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="font-bold text-slate-500 dark:text-slate-400">Título</dt>
              <dd className="mt-1 font-black text-slate-900 dark:text-white">{lastParsed.draft.title || 'Pendiente'}</dd>
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
