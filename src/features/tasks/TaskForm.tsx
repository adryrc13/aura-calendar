import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RecurrenceType, Task, TaskDraft, TaskFormValues } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, RECURRENCE_TYPE_OPTIONS, TASK_COLORS, WEEKDAY_OPTIONS } from '../../domain/tasks/task';
import { todayInputValue } from '../../shared/date';
import { Icon, type IconName } from '../../shared/icons';
import { useI18n } from '../../shared/i18n';
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
  const { t } = useI18n();
  const [draft, setDraft] = useState<TaskDraft>(() => buildInitialDraft(task, initialValues));
  const [reminderMinutesInput, setReminderMinutesInput] = useState(() => `${draft.reminderMinutesBefore}`);
  const [recurrenceIntervalInput, setRecurrenceIntervalInput] = useState(() => `${draft.recurrenceInterval}`);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
    setSubmitError('');
    setIsSaving(true);

    try {
      await onSubmit(validatedDraft);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
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
              {t('task.title')}
            </label>
            <input
              id="task-title"
              className="aura-input mt-2"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder={t('task.titlePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="aura-label" htmlFor="task-description">
              {t('task.description')}
            </label>
            <textarea
              id="task-description"
              className="aura-input mt-2 min-h-24 resize-none"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder={t('task.descriptionPlaceholder')}
            />
          </div>
        </div>
      </section>

      <section className="aura-card overflow-hidden">
        <FormRow icon="calendar" label={t('task.date')} htmlFor="task-date">
          <input
            id="task-date"
            className="aura-input text-right"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </FormRow>

        <FormRow icon="clock" label={t('task.time')} htmlFor="task-time">
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
                    {t('common.useValue', { value: time })}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </FormRow>

        <FormRow icon="timer" label={t('task.endTime')} htmlFor="task-end-time">
          <input
            id="task-end-time"
            className="aura-input text-right"
            type="time"
            value={draft.endTime ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value || undefined }))}
          />
        </FormRow>

        <FormRow icon="palette" label={t('task.color')}>
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
                  aria-label={`${t('task.color')} ${t(`color.${color.value}`)}`}
                />
              );
            })}
          </div>
        </FormRow>
      </section>

      <section className="aura-card overflow-hidden">
        <FormRow icon="bell" label={t('task.reminder')} htmlFor="task-reminder-enabled">
          <input
            id="task-reminder-enabled"
            type="checkbox"
            checked={draft.reminderEnabled}
            onChange={(event) => setDraft((current) => ({ ...current, reminderEnabled: event.target.checked }))}
            className="aura-switch"
          />
        </FormRow>

        <FormRow icon="timer" label={t('task.minutesBefore')} htmlFor="task-reminder-minutes">
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

        <FormRow icon="volumeOff" label={t('task.noSound')} htmlFor="task-reminder-silent">
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
        <FormRow icon="repeat" label={t('recurrence.title')} htmlFor="task-recurrence-type">
          <RecurrenceTypeSelect
            id="task-recurrence-type"
            value={draft.recurrenceType}
            onChange={updateRecurrenceType}
          />
        </FormRow>

        {draft.recurrenceType !== 'none' ? (
          <>
            {(draft.recurrenceType === 'custom-days' ||
              draft.recurrenceType === 'custom-weeks' ||
              draft.recurrenceType === 'weekly' ||
              draft.recurrenceType === 'monthly' ||
              draft.recurrenceType === 'yearly') ? (
              <FormRow icon="calendar" label={t('recurrence.interval')} htmlFor="task-recurrence-interval">
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
                <p className="aura-label">{t('recurrence.weekdays')}</p>
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
                        {t(`weekday.${day.value}`)}
                      </button>
                    );
                  })}
                </div>
                <p className="aura-muted mt-2 text-xs">
                  {t('recurrence.weekdaysHint')}
                </p>
              </div>
            ) : null}

            {(draft.recurrenceType === 'monthly' || draft.recurrenceType === 'month-days') ? (
              <div className="border-b border-slate-200/50 p-4 last:border-b-0 dark:border-slate-800/70">
                <label className="aura-label" htmlFor="task-recurrence-month-days">
                  {t('recurrence.monthDays')}
                </label>
                <input
                  id="task-recurrence-month-days"
                  className="aura-input mt-2"
                  value={draft.recurrenceDaysOfMonth.join(', ')}
                  onChange={(event) => updateMonthDays(event.target.value)}
                  placeholder="1, 15"
                />
                <p className="aura-muted mt-2 text-xs">{t('recurrence.monthDaysHint')}</p>
              </div>
            ) : null}

            <FormRow icon="flag" label={t('recurrence.repeatUntil')} htmlFor="task-recurrence-end-date">
              <input
                id="task-recurrence-end-date"
                className="aura-input text-right"
                type="date"
                value={draft.recurrenceEndDate ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, recurrenceEndDate: event.target.value || undefined }))}
              />
            </FormRow>

            <FormRow icon="hash" label={t('recurrence.maxCount')} htmlFor="task-recurrence-count">
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
                placeholder={t('common.optional')}
              />
            </FormRow>
          </>
        ) : null}
      </section>

      {submitError ? <div className="aura-alert">{submitError}</div> : null}

      <div className="flex justify-start gap-3 pt-2">
        <button type="button" onClick={onCancel} className="aura-secondary min-w-32">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={isSaving || !draft.title.trim()} className="aura-primary min-w-40">
          {isSaving ? t('task.saving') : task ? t('common.save') : t('common.createTask')}
        </button>
      </div>
    </form>
  );
}

interface RecurrenceTypeSelectProps {
  id: string;
  value: RecurrenceType;
  onChange: (value: RecurrenceType) => void;
}

interface FloatingMenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

function RecurrenceTypeSelect({ id, value, onChange }: RecurrenceTypeSelectProps) {
  const { t } = useI18n();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const selectedIndex = Math.max(0, RECURRENCE_TYPE_OPTIONS.findIndex((option) => option.value === value));
  const selectedOption = RECURRENCE_TYPE_OPTIONS[selectedIndex] ?? RECURRENCE_TYPE_OPTIONS[0];
  const selectedOptionLabel = t(`recurrence.option.${selectedOption.value}`);

  function updateMenuPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const availableAbove = rect.top - gap - viewportPadding;
    const openAbove = availableBelow < 250 && availableAbove > availableBelow;
    const availableHeight = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.min(320, Math.max(176, availableHeight));
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - gap - maxHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - maxHeight);

    setMenuPosition({ top, left, width, maxHeight });
  }

  function closeMenu() {
    setIsOpen(false);
  }

  function focusOption(index: number) {
    const nextIndex = (index + RECURRENCE_TYPE_OPTIONS.length) % RECURRENCE_TYPE_OPTIONS.length;
    setFocusedIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function selectOption(recurrenceType: RecurrenceType, index: number) {
    onChange(recurrenceType);
    setFocusedIndex(index);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleTriggerClick() {
    updateMenuPosition();
    setFocusedIndex(selectedIndex);
    setIsOpen((current) => !current);
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    updateMenuPosition();
    setFocusedIndex(selectedIndex);
    setIsOpen(true);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(focusedIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(focusedIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusOption(RECURRENCE_TYPE_OPTIONS.length - 1);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    const animationFrame = window.requestAnimationFrame(() => focusOption(selectedIndex));

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen, selectedIndex]);

  return (
    <div ref={rootRef} className="w-full">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className={`aura-input flex items-center justify-end gap-2 pr-3 text-right font-semibold hover:border-cyan-300 hover:shadow-[0_0_18px_rgba(34,211,238,0.18)] focus:border-cyan-300 focus:shadow-[0_0_22px_rgba(34,211,238,0.22)] ${
          isOpen ? 'border-cyan-300 ring-4 ring-cyan-400/20' : ''
        }`}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="min-w-0 truncate">{selectedOptionLabel}</span>
        <Icon
          name="chevronDown"
          className={`h-5 w-5 shrink-0 text-slate-500 transition dark:text-slate-300 ${
            isOpen ? 'rotate-180 text-cyan-600 dark:text-cyan-200' : ''
          }`}
        />
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              className="fixed z-[80] overflow-y-auto rounded-3xl border border-cyan-300/50 bg-white/95 p-2 text-sm shadow-[0_18px_60px_rgba(14,165,233,0.22)] backdrop-blur-xl dark:border-cyan-400/25 dark:bg-slate-950/95 dark:shadow-[0_18px_70px_rgba(34,211,238,0.16)]"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
              onKeyDown={handleMenuKeyDown}
            >
              {RECURRENCE_TYPE_OPTIONS.map((option, index) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left font-bold outline-none transition ${
                      isSelected
                        ? 'bg-cyan-500 text-white shadow-[0_0_18px_rgba(34,211,238,0.26)]'
                        : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 focus:bg-cyan-50 focus:text-cyan-800 dark:text-slate-200 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100 dark:focus:bg-cyan-500/10 dark:focus:text-cyan-100'
                    }`}
                    onClick={() => selectOption(option.value, index)}
                    onFocus={() => setFocusedIndex(index)}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <span>{t(`recurrence.option.${option.value}`)}</span>
                    {isSelected ? <Icon name="check" className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
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
