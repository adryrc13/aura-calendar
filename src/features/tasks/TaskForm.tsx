import { useEffect, useState, type FormEvent } from 'react';
import type { Task, TaskDraft, TaskFormValues } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, TASK_COLORS } from '../../domain/tasks/task';
import { todayInputValue } from '../../shared/date';

interface TaskFormProps {
  task?: Task;
  initialValues?: TaskFormValues;
  onCancel: () => void;
  onSubmit: (draft: TaskDraft) => Promise<void>;
}

function buildInitialDraft(task?: Task, initialValues?: TaskFormValues): TaskDraft {
  if (task) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = task;
    return draft;
  }

  return {
    ...DEFAULT_TASK_DRAFT,
    date: initialValues?.date ?? todayInputValue(),
    time: initialValues?.time ?? '09:00',
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    endTime: initialValues?.endTime,
    completed: initialValues?.completed ?? DEFAULT_TASK_DRAFT.completed,
    color: initialValues?.color ?? DEFAULT_TASK_DRAFT.color,
    textColor: initialValues?.textColor ?? DEFAULT_TASK_DRAFT.textColor,
    reminderEnabled: initialValues?.reminderEnabled ?? DEFAULT_TASK_DRAFT.reminderEnabled,
    reminderMinutesBefore: initialValues?.reminderMinutesBefore ?? DEFAULT_TASK_DRAFT.reminderMinutesBefore,
    reminderSilent: initialValues?.reminderSilent ?? DEFAULT_TASK_DRAFT.reminderSilent,
  };
}

export function TaskForm({ task, initialValues, onCancel, onSubmit }: TaskFormProps) {
  const [draft, setDraft] = useState<TaskDraft>(() => buildInitialDraft(task, initialValues));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(buildInitialDraft(task, initialValues));
  }, [task, initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.title.trim()) {
      return;
    }

    setIsSaving(true);
    await onSubmit(draft);
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="aura-label" htmlFor="task-title">
          Título
        </label>
        <input
          id="task-title"
          className="aura-input mt-2"
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="Ej: tomar medicación"
          required
        />
      </div>

      <div>
        <label className="aura-label" htmlFor="task-description">
          Descripción
        </label>
        <textarea
          id="task-description"
          className="aura-input mt-2 min-h-24 resize-none"
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="Notas, detalles o contexto"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="aura-label" htmlFor="task-date">
            Fecha
          </label>
          <input
            id="task-date"
            className="aura-input mt-2"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </div>
        <div>
          <label className="aura-label" htmlFor="task-time">
            Hora
          </label>
          <input
            id="task-time"
            className="aura-input mt-2"
            type="time"
            value={draft.time}
            onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="aura-label" htmlFor="task-end-time">
            Fin opcional
          </label>
          <input
            id="task-end-time"
            className="aura-input mt-2"
            type="time"
            value={draft.endTime ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value || undefined }))}
          />
        </div>
        <div>
          <label className="aura-label" htmlFor="task-color">
            Color
          </label>
          <select
            id="task-color"
            className="aura-input mt-2"
            value={draft.color}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                color: event.target.value as TaskDraft['color'],
                textColor:
                  TASK_COLORS.find((color) => color.value === event.target.value)?.textColor ?? DEFAULT_TASK_DRAFT.textColor,
              }))
            }
          >
            {TASK_COLORS.map((color) => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-950">
        <label className="flex items-center justify-between gap-4 text-sm font-bold text-slate-800 dark:text-slate-100">
          Activar recordatorio
          <input
            type="checkbox"
            checked={draft.reminderEnabled}
            onChange={(event) => setDraft((current) => ({ ...current, reminderEnabled: event.target.checked }))}
            className="h-5 w-5 accent-violet-600"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="aura-label" htmlFor="task-reminder-minutes">
              Minutos antes
            </label>
            <input
              id="task-reminder-minutes"
              className="aura-input mt-2"
              type="number"
              min={0}
              value={draft.reminderMinutesBefore}
              onChange={(event) =>
                setDraft((current) => ({ ...current, reminderMinutesBefore: Number(event.target.value) }))
              }
              disabled={!draft.reminderEnabled}
            />
          </div>
          <label className="mt-7 flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
            Sin sonido
            <input
              type="checkbox"
              checked={draft.reminderSilent}
              onChange={(event) => setDraft((current) => ({ ...current, reminderSilent: event.target.checked }))}
              className="h-5 w-5 accent-violet-600"
              disabled={!draft.reminderEnabled}
            />
          </label>
        </div>
      </section>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving || !draft.title.trim()}
          className="flex-1 rounded-2xl bg-violet-600 px-4 py-3 font-black text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Guardando…' : task ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </form>
  );
}
