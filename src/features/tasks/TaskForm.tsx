import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { RecurrenceType, Task, TaskDraft, TaskFormValues } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, RECURRENCE_TYPE_OPTIONS, TASK_COLORS, WEEKDAY_OPTIONS } from '../../domain/tasks/task';
import { todayInputValue } from '../../shared/date';
import { Icon, type IconName } from '../../shared/icons';
import { AttachmentEditor } from './TaskAttachments';

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
    attachments: initialValues?.attachments ?? DEFAULT_TASK_DRAFT.attachments,
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
      {assistantNotice ? <div className="aura-alert">{assistantNotice}</div> : null}

      <section className="aura-card overflow-hidden">
        <div className="space-y-4 p-4">
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
        </div>
      </section>

      <section className="aura-card overflow-hidden">
        <FormRow icon="calendar" label="Fecha" htmlFor="task-date">
          <input
            id="task-date"
            className="aura-input text-right"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </FormRow>

        <FormRow icon="clock" label="Hora" htmlFor="task-time">
          <div className="w-full">
            <input
              id="task-time"
              className="aura-input text-right"
              type="time"
              value={draft.time}
              onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
              required
            />
            {suggestedTimes?.length ? (
              <div className="mt-2 flex flex-wrap justify-end gap-2">
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
        </FormRow>

        <FormRow icon="timer" label="Fin opcional" htmlFor="task-end-time">
          <input
            id="task-end-time"
            className="aura-input text-right"
            type="time"
            value={draft.endTime ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value || undefined }))}
          />
        </FormRow>

        <FormRow icon="palette" label="Color">
          <div className="flex flex-wrap justify-end gap-3">
            {TASK_COLORS.map((color) => {
              const isSelected = draft.color === color.value;

              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      color: color.value,
                      textColor: color.textColor,
                    }))
                  }
                  className={`h-9 w-9 rounded-full border-2 transition ${
                    isSelected
                      ? 'border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.55)] ring-4 ring-cyan-400/20'
                      : 'border-white/70 hover:scale-105 dark:border-slate-700'
                  }`}
                  style={{ background: color.swatch }}
                  aria-label={`Color ${color.label}`}
                />
              );
            })}
          </div>
        </FormRow>
      </section>

      <section className="aura-card overflow-hidden">
        <FormRow icon="bell" label="Recordatorio" htmlFor="task-reminder-enabled">
          <input
            id="task-reminder-enabled"
            type="checkbox"
            checked={draft.reminderEnabled}
            onChange={(event) => setDraft((current) => ({ ...current, reminderEnabled: event.target.checked }))}
            className="aura-switch"
          />
        </FormRow>

        <FormRow icon="timer" label="Minutos antes" htmlFor="task-reminder-minutes">
          <input
            id="task-reminder-minutes"
            className="aura-input text-right"
            type="number"
            min={0}
            value={reminderMinutesInput}
            onChange={(event) => updateReminderMinutes(event.target.value)}
            onBlur={validateReminderMinutes}
            disabled={!draft.reminderEnabled}
          />
        </FormRow>

        <FormRow icon="volumeOff" label="Sin sonido" htmlFor="task-reminder-silent">
          <input
            id="task-reminder-silent"
            type="checkbox"
            checked={draft.reminderSilent}
            onChange={(event) => setDraft((current) => ({ ...current, reminderSilent: event.target.checked }))}
            className="aura-switch"
            disabled={!draft.reminderEnabled}
          />
        </FormRow>
      </section>

      <AttachmentEditor
        attachments={draft.attachments ?? []}
        onChange={(attachments) => setDraft((current) => ({ ...current, attachments }))}
      />

      <section className="aura-card overflow-hidden">
        <FormRow icon="repeat" label="Repetición" htmlFor="task-recurrence-type">
          <div className="relative w-full">
            <select
              id="task-recurrence-type"
              className="aura-input appearance-none pr-10 text-right"
              value={draft.recurrenceType}
              onChange={(event) => updateRecurrenceType(event.target.value as RecurrenceType)}
            >
              {RECURRENCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
          </div>
        </FormRow>

        {draft.recurrenceType !== 'none' ? (
          <>
            {(draft.recurrenceType === 'custom-days' ||
              draft.recurrenceType === 'custom-weeks' ||
              draft.recurrenceType === 'weekly' ||
              draft.recurrenceType === 'monthly' ||
              draft.recurrenceType === 'yearly') ? (
              <FormRow icon="calendar" label="Intervalo" htmlFor="task-recurrence-interval">
                <input
                  id="task-recurrence-interval"
                  className="aura-input text-right"
                  type="number"
                  min={1}
                  value={recurrenceIntervalInput}
                  onChange={(event) => updateRecurrenceInterval(event.target.value)}
                  onBlur={validateRecurrenceInterval}
                />
              </FormRow>
            ) : null}

            {(draft.recurrenceType === 'weekly' ||
              draft.recurrenceType === 'custom-weeks' ||
              draft.recurrenceType === 'weekdays') ? (
              <div className="border-b border-slate-200/50 p-4 last:border-b-0 dark:border-slate-800/70">
                <p className="aura-label">Días de la semana</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const isSelected = draft.recurrenceDaysOfWeek.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={`rounded-2xl border px-3 py-2 text-sm font-black transition ${
                          isSelected
                            ? 'border-cyan-300 bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                            : 'border-cyan-500/10 bg-white/60 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 dark:bg-slate-950/40 dark:text-slate-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <p className="aura-muted mt-2 text-xs">
                  Si no elegís días, se usa el día inicial de la tarea.
                </p>
              </div>
            ) : null}

            {(draft.recurrenceType === 'monthly' || draft.recurrenceType === 'month-days') ? (
              <div className="border-b border-slate-200/50 p-4 last:border-b-0 dark:border-slate-800/70">
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
                <p className="aura-muted mt-2 text-xs">Separá con comas. Si queda vacío, se usa el día inicial.</p>
              </div>
            ) : null}

            <FormRow icon="flag" label="Repetir hasta" htmlFor="task-recurrence-end-date">
              <input
                id="task-recurrence-end-date"
                className="aura-input text-right"
                type="date"
                value={draft.recurrenceEndDate ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, recurrenceEndDate: event.target.value || undefined }))}
              />
            </FormRow>

            <FormRow icon="hash" label="Máx. veces" htmlFor="task-recurrence-count">
              <input
                id="task-recurrence-count"
                className="aura-input text-right"
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
            </FormRow>
          </>
        ) : null}
      </section>

      <div className="flex justify-start gap-3 pt-2">
        <button type="button" onClick={onCancel} className="aura-secondary min-w-32">
          Cancelar
        </button>
        <button type="submit" disabled={isSaving || !draft.title.trim()} className="aura-primary min-w-40">
          {isSaving ? 'Guardando…' : task ? 'Guardar' : 'Crear tarea'}
        </button>
      </div>
    </form>
  );
}

function FormRow({ icon, label, htmlFor, children }: { icon: IconName; label: string; htmlFor?: string; children: ReactNode }) {
  const labelClassName = 'min-w-0 flex-1 text-base font-semibold text-slate-900 dark:text-slate-100';

  return (
    <div className="aura-form-row">
      <span className="aura-row-icon">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      {htmlFor ? (
        <label className={labelClassName} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className={labelClassName}>{label}</span>
      )}
      <div className="flex min-w-[9rem] flex-1 justify-end">{children}</div>
    </div>
  );
}
