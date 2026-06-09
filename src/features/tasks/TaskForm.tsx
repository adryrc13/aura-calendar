import { useEffect, useState, type FormEvent } from 'react';
import type { RecurrenceType, Task, TaskDraft, TaskFormValues } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, RECURRENCE_TYPE_OPTIONS, TASK_COLORS, WEEKDAY_OPTIONS } from '../../domain/tasks/task';
import { todayInputValue } from '../../shared/date';

interface TaskFormProps {
  task?: Task;
  initialValues?: TaskFormValues;
  assistantNotice?: string;
  suggestedTimes?: string[];
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
    recurrenceType: initialValues?.recurrenceType ?? DEFAULT_TASK_DRAFT.recurrenceType,
    recurrenceInterval: initialValues?.recurrenceInterval ?? DEFAULT_TASK_DRAFT.recurrenceInterval,
    recurrenceDaysOfWeek: initialValues?.recurrenceDaysOfWeek ?? DEFAULT_TASK_DRAFT.recurrenceDaysOfWeek,
    recurrenceDaysOfMonth: initialValues?.recurrenceDaysOfMonth ?? DEFAULT_TASK_DRAFT.recurrenceDaysOfMonth,
    recurrenceEndDate: initialValues?.recurrenceEndDate,
    recurrenceCount: initialValues?.recurrenceCount,
    recurrenceRule: initialValues?.recurrenceRule,
    parentTaskId: initialValues?.parentTaskId,
    exceptionDates: initialValues?.exceptionDates ?? DEFAULT_TASK_DRAFT.exceptionDates,
    modifiedOccurrences: initialValues?.modifiedOccurrences ?? DEFAULT_TASK_DRAFT.modifiedOccurrences,
  };
}

export function TaskForm({ task, initialValues, assistantNotice, suggestedTimes, onCancel, onSubmit }: TaskFormProps) {
  const [draft, setDraft] = useState<TaskDraft>(() => buildInitialDraft(task, initialValues));
  const [reminderMinutesInput, setReminderMinutesInput] = useState(() => `${draft.reminderMinutesBefore}`);
  const [recurrenceIntervalInput, setRecurrenceIntervalInput] = useState(() => `${draft.recurrenceInterval}`);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const nextDraft = buildInitialDraft(task, initialValues);
    setDraft(nextDraft);
    setReminderMinutesInput(`${nextDraft.reminderMinutesBefore}`);
    setRecurrenceIntervalInput(`${nextDraft.recurrenceInterval}`);
  }, [task, initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validatedDraft = validateNumericFields(draft);

    if (!validatedDraft.title.trim()) {
      return;
    }

    setDraft(validatedDraft);
    setReminderMinutesInput(`${validatedDraft.reminderMinutesBefore}`);
    setRecurrenceIntervalInput(`${validatedDraft.recurrenceInterval}`);
    setIsSaving(true);
    await onSubmit(validatedDraft);
    setIsSaving(false);
  }

  function validateNumericFields(current: TaskDraft): TaskDraft {
    const reminderMinutesBefore = reminderMinutesInput === '' ? 0 : Number(reminderMinutesInput);
    const recurrenceInterval = recurrenceIntervalInput === '' ? 1 : Number(recurrenceIntervalInput);

    return {
      ...current,
      reminderMinutesBefore: Math.max(0, Number.isFinite(reminderMinutesBefore) ? reminderMinutesBefore : 0),
      recurrenceInterval: Math.max(1, Number.isFinite(recurrenceInterval) ? recurrenceInterval : 1),
    };
  }

  function updateReminderMinutes(value: string) {
    if (!/^\d*$/.test(value)) return;

    setReminderMinutesInput(value);

    if (value !== '') {
      setDraft((current) => ({ ...current, reminderMinutesBefore: Math.max(0, Number(value)) }));
    }
  }

  function validateReminderMinutes() {
    const value = reminderMinutesInput === '' ? 0 : Math.max(0, Number(reminderMinutesInput));
    setReminderMinutesInput(`${value}`);
    setDraft((current) => ({ ...current, reminderMinutesBefore: value }));
  }

  function updateRecurrenceInterval(value: string) {
    if (!/^\d*$/.test(value)) return;

    setRecurrenceIntervalInput(value);

    if (value !== '') {
      setDraft((current) => ({ ...current, recurrenceInterval: Math.max(1, Number(value)) }));
    }
  }

  function validateRecurrenceInterval() {
    const value = recurrenceIntervalInput === '' ? 1 : Math.max(1, Number(recurrenceIntervalInput));
    setRecurrenceIntervalInput(`${value}`);
    setDraft((current) => ({ ...current, recurrenceInterval: value }));
  }

  function updateRecurrenceType(recurrenceType: RecurrenceType) {
    setDraft((current) => ({
      ...current,
      recurrenceType,
      recurrenceInterval: current.recurrenceInterval || 1,
      recurrenceDaysOfWeek:
        recurrenceType === 'weekly' || recurrenceType === 'custom-weeks' || recurrenceType === 'weekdays'
          ? current.recurrenceDaysOfWeek
          : [],
      recurrenceDaysOfMonth: recurrenceType === 'monthly' || recurrenceType === 'month-days' ? current.recurrenceDaysOfMonth : [],
    }));
  }

  function toggleWeekday(day: number) {
    setDraft((current) => {
      const days = new Set(current.recurrenceDaysOfWeek);
      if (days.has(day)) {
        days.delete(day);
      } else {
        days.add(day);
      }

      return { ...current, recurrenceDaysOfWeek: Array.from(days).sort((a, b) => a - b) };
    });
  }

  function updateMonthDays(value: string) {
    const days = value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);

    setDraft((current) => ({ ...current, recurrenceDaysOfMonth: Array.from(new Set(days)).sort((a, b) => a - b) }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {assistantNotice ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {assistantNotice}
        </div>
      ) : null}

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
          {suggestedTimes?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestedTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, time }))}
                  className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-100"
                >
                  Usar {time}
                </button>
              ))}
            </div>
          ) : null}
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
              value={reminderMinutesInput}
              onChange={(event) => updateReminderMinutes(event.target.value)}
              onBlur={validateReminderMinutes}
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

      <section className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-950">
        <div>
          <label className="aura-label" htmlFor="task-recurrence-type">
            Repetición
          </label>
          <select
            id="task-recurrence-type"
            className="aura-input mt-2"
            value={draft.recurrenceType}
            onChange={(event) => updateRecurrenceType(event.target.value as RecurrenceType)}
          >
            {RECURRENCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {draft.recurrenceType !== 'none' ? (
          <div className="mt-4 space-y-4">
            {(draft.recurrenceType === 'custom-days' ||
              draft.recurrenceType === 'custom-weeks' ||
              draft.recurrenceType === 'weekly' ||
              draft.recurrenceType === 'monthly' ||
              draft.recurrenceType === 'yearly') ? (
              <div>
                <label className="aura-label" htmlFor="task-recurrence-interval">
                  Intervalo
                </label>
                <input
                  id="task-recurrence-interval"
                  className="aura-input mt-2"
                  type="number"
                  min={1}
                  value={recurrenceIntervalInput}
                  onChange={(event) => updateRecurrenceInterval(event.target.value)}
                  onBlur={validateRecurrenceInterval}
                />
              </div>
            ) : null}

            {(draft.recurrenceType === 'weekly' ||
              draft.recurrenceType === 'custom-weeks' ||
              draft.recurrenceType === 'weekdays') ? (
              <div>
                <p className="aura-label">Días de la semana</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const isSelected = draft.recurrenceDaysOfWeek.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={`rounded-2xl px-3 py-2 text-sm font-black transition ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                            : 'bg-white text-slate-700 hover:bg-violet-50 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Si no elegís días, se usa el día inicial de la tarea.
                </p>
              </div>
            ) : null}

            {(draft.recurrenceType === 'monthly' || draft.recurrenceType === 'month-days') ? (
              <div>
                <label className="aura-label" htmlFor="task-recurrence-month-days">
                  Días del mes
                </label>
                <input
                  id="task-recurrence-month-days"
                  className="aura-input mt-2"
                  value={draft.recurrenceDaysOfMonth.join(', ')}
                  onChange={(event) => updateMonthDays(event.target.value)}
                  placeholder="1, 15"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Separá con comas. Si queda vacío, se usa el día inicial.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="aura-label" htmlFor="task-recurrence-end-date">
                  Repetir hasta
                </label>
                <input
                  id="task-recurrence-end-date"
                  className="aura-input mt-2"
                  type="date"
                  value={draft.recurrenceEndDate ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, recurrenceEndDate: event.target.value || undefined }))}
                />
              </div>
              <div>
                <label className="aura-label" htmlFor="task-recurrence-count">
                  Máx. veces
                </label>
                <input
                  id="task-recurrence-count"
                  className="aura-input mt-2"
                  type="number"
                  min={1}
                  value={draft.recurrenceCount ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      recurrenceCount: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
        ) : null}
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
