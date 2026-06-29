import { useMemo, useState } from 'react';
import type { Task, TaskDraft, TaskFormValues } from '../domain/tasks/task';
import { isRecurringTask, isVirtualOccurrence } from '../domain/tasks/recurrence';
import { useReminderScheduler } from '../infrastructure/notifications/reminderScheduler';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { parseTaskCommand } from '../features/assistant/taskCommandParser';
import { useVoiceRecognition } from '../features/assistant/useVoiceRecognition';
import { AgendaView, DayView, MonthView } from '../features/calendar/CalendarViews';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { TaskForm } from '../features/tasks/TaskForm';
import { useTasks } from '../features/tasks/useTasks';
import { parseInputDate, todayInputValue } from '../shared/date';
import { Icon, type IconName } from '../shared/icons';
import { useI18n } from '../shared/i18n';
import { useTheme } from './providers/ThemeProvider';

type AppView = 'today' | 'calendar' | 'agenda' | 'assistant' | 'settings';

interface TaskModalState {
  mode: 'create' | 'edit';
  task?: Task;
  initialValues?: TaskFormValues;
  assistantNotice?: string;
  suggestedTimes?: string[];
}

interface SeriesActionState {
  action: 'edit' | 'delete';
  task: Task;
}

const NAV_ITEMS: Array<{ view: AppView; labelKey: string; icon: IconName }> = [
  { view: 'today', labelKey: 'nav.today', icon: 'calendar' },
  { view: 'calendar', labelKey: 'nav.calendar', icon: 'calendarDots' },
  { view: 'agenda', labelKey: 'nav.agenda', icon: 'list' },
  { view: 'assistant', labelKey: 'nav.assistant', icon: 'sparkles' },
  { view: 'settings', labelKey: 'nav.settings', icon: 'settings' },
];

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { language, t } = useI18n();
  const {
    tasks,
    stats,
    isLoading,
    taskRepositoryMode,
    activeCalendar,
    activeCalendarPermission,
    canWriteActiveCalendar,
    taskError,
    clearTaskError,
    createTask,
    updateTask,
    deleteTask,
    deleteOccurrence,
    toggleTaskCompleted,
  } = useTasks();
  const [activeView, setActiveView] = useState<AppView>('today');
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [monthDate, setMonthDate] = useState(new Date());
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [seriesAction, setSeriesAction] = useState<SeriesActionState | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('');
  const showHomeSummary = activeView !== 'calendar' && activeView !== 'settings';
  const showAssistantHero = activeView !== 'assistant' && activeView !== 'calendar' && activeView !== 'settings';
  const showFloatingActions = activeView !== 'settings' && activeView !== 'calendar';

  useReminderScheduler(tasks);

  const selectedDateObject = useMemo(() => parseInputDate(selectedDate), [selectedDate]);
  const { startListening } = useVoiceRecognition({
    onTranscript: (transcript) => {
      const parsed = parseTaskCommand(transcript, language);
      const assistantNotice = parsed.confirmationReasons.join(' ');
      setActiveView('assistant');
      setVoiceStatus(
        parsed.confidence === 'complete'
          ? parsed.summary
          : `${parsed.summary} ${t('app.confirmPrefix', { reasons: assistantNotice })}`,
      );
      openCreateTask(parsed.draft, assistantNotice, parsed.detected.suggestedTimes);
    },
  });

  function selectDate(date: string) {
    setSelectedDate(date);
    setMonthDate(parseInputDate(date));
  }

  function goToday() {
    const today = todayInputValue();
    selectDate(today);
    setActiveView('today');
  }

  function openCreateTask(initialValues?: TaskFormValues | string, assistantNotice?: string, suggestedTimes?: string[]) {
    if (!canWriteActiveCalendar) return;

    const values =
      typeof initialValues === 'string'
        ? { date: initialValues, time: '09:00' }
        : (initialValues ?? { date: selectedDate, time: '09:00' });

    setTaskModal({ mode: 'create', initialValues: values, assistantNotice, suggestedTimes });
  }

  function openEditTask(task: Task) {
    if (!canWriteActiveCalendar) return;

    if (isRecurringTask(task) || isVirtualOccurrence(task)) {
      setSeriesAction({ action: 'edit', task });
      return;
    }

    setTaskModal({ mode: 'edit', task });
  }

  function editWholeSeries(task: Task) {
    const series = resolveSeriesTask(task);
    setSeriesAction(null);

    if (series) {
      setTaskModal({ mode: 'edit', task: series });
    }
  }

  async function handleTaskSubmit(draft: TaskDraft) {
    clearTaskError();

    if (taskModal?.mode === 'edit' && taskModal.task) {
      await updateTask(taskModal.task, draft);
    } else {
      const createdTask = await createTask(draft);
      selectDate(createdTask.date);
    }

    setTaskModal(null);
  }

  async function handleDeleteTask(task: Task) {
    if (isRecurringTask(task) || isVirtualOccurrence(task)) {
      setSeriesAction({ action: 'delete', task });
      return;
    }

    const shouldDelete = window.confirm(t('app.deleteConfirm', { title: task.title }));
    if (!shouldDelete) return;
    try {
      await deleteTask(task.id);
    } catch {
      // useTasks ya expone el error de forma visible sin romper la UI.
    }
  }

  async function deleteWholeSeries(task: Task) {
    const series = resolveSeriesTask(task);
    setSeriesAction(null);

    if (series) {
      try {
        await deleteTask(series.id);
      } catch {
        // useTasks ya expone el error de forma visible sin romper la UI.
      }
    }
  }

  async function deleteSingleOccurrence(task: Task) {
    setSeriesAction(null);
    try {
      await deleteOccurrence(task);
    } catch {
      // useTasks ya expone el error de forma visible sin romper la UI.
    }
  }

  async function handleToggleTaskCompleted(task: Task) {
    try {
      await toggleTaskCompleted(task);
    } catch {
      // useTasks ya expone el error de forma visible sin romper la UI.
    }
  }

  function resolveSeriesTask(task: Task) {
    return task.sourceTaskId ? tasks.find((item) => item.id === task.sourceTaskId) : task;
  }

  function renderActiveView() {
    if (isLoading) {
      return (
        <div className="aura-card p-6 text-center text-sm font-bold text-slate-600 dark:text-slate-300">
          {t('app.loadingTasks', { mode: taskRepositoryMode })}
        </div>
      );
    }

    if (activeView === 'calendar') {
      return (
        <MonthView
          monthDate={monthDate}
          selectedDate={selectedDate}
          tasks={tasks}
          onChangeMonth={setMonthDate}
          onSelectDate={selectDate}
          onCreateTask={openCreateTask}
          onEditTask={openEditTask}
          onDeleteTask={handleDeleteTask}
          onToggleTask={handleToggleTaskCompleted}
          canWriteTasks={canWriteActiveCalendar}
        />
      );
    }

    if (activeView === 'agenda') {
      return (
        <AgendaView
          tasks={tasks}
          onCreateTask={openCreateTask}
          onEditTask={openEditTask}
          onDeleteTask={handleDeleteTask}
          onToggleTask={handleToggleTaskCompleted}
          canWriteTasks={canWriteActiveCalendar}
        />
      );
    }

    if (activeView === 'assistant') {
      return (
        <AssistantPanel
          onCreateDraft={(parsed) =>
            openCreateTask(parsed.draft, parsed.confirmationReasons.join(' '), parsed.detected.suggestedTimes)
          }
          canWriteTasks={canWriteActiveCalendar}
        />
      );
    }

    if (activeView === 'settings') {
      return <SettingsPanel />;
    }

    return (
      <DayView
        selectedDate={selectedDate}
        tasks={tasks}
        onSelectDate={selectDate}
        onCreateTask={openCreateTask}
        onEditTask={openEditTask}
        onDeleteTask={handleDeleteTask}
        onToggleTask={handleToggleTaskCompleted}
        canWriteTasks={canWriteActiveCalendar}
      />
    );
  }

  function handleStartVoice() {
    if (!canWriteActiveCalendar) {
      setActiveView('assistant');
      setVoiceStatus(t('sharing.viewerReadonly'));
      return;
    }

    startListening((message, status) => {
      setVoiceStatus(message);
      if (status === 'unsupported') {
        setActiveView('assistant');
      }
    });
  }

  return (
    <div className="aura-app-shell">
      <header className="sticky top-0 z-20 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={goToday} className="min-w-0 text-left" aria-label={t('app.goToday')}>
            <AuraLogo />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="aura-icon-button h-14 w-14 rounded-3xl text-cyan-700 shadow-lg shadow-cyan-500/10 dark:text-cyan-100"
            aria-label={theme === 'dark' ? t('app.themeToLight') : t('app.themeToDark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className={`mx-auto max-w-5xl px-4 pt-2 ${activeView === 'calendar' ? 'space-y-3 pb-40' : activeView === 'settings' ? 'space-y-5 pb-44' : 'space-y-5 pb-36'}`}>
        {taskRepositoryMode === 'remote' && activeCalendar ? (
          <div className="aura-card flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="aura-label">{t('sharing.activeCalendar')}</p>
              <p className="truncate font-black text-slate-950 dark:text-white">
                {activeCalendar.name} · {t(`sharing.role.${activeCalendarPermission?.role ?? activeCalendar.role}`)}
              </p>
            </div>
            {!canWriteActiveCalendar ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
                {t('sharing.viewerReadonly')}
              </span>
            ) : null}
          </div>
        ) : null}

        {showHomeSummary ? <StatsCard pending={stats.pending} completed={stats.completed} /> : null}

        {showAssistantHero ? <AssistantHero onMicClick={handleStartVoice} disabled={!canWriteActiveCalendar} /> : null}

        {voiceStatus ? (
          <div className="aura-alert">
            {voiceStatus}
          </div>
        ) : null}

        {taskError ? (
          <div className="aura-alert flex items-start justify-between gap-3">
            <span>{taskError}</span>
            <button type="button" onClick={clearTaskError} className="text-xs font-black uppercase tracking-wide">
              {t('common.close')}
            </button>
          </div>
        ) : null}

        {renderActiveView()}
      </main>

      {showFloatingActions ? (
      <div className="fixed bottom-28 right-4 z-30 flex items-center gap-3 lg:right-[calc((100vw-64rem)/2+1rem)]">
        <button
          type="button"
          onClick={handleStartVoice}
          disabled={!canWriteActiveCalendar}
          className="aura-fab h-14 w-14"
          aria-label={canWriteActiveCalendar ? t('app.voiceCreate') : t('sharing.insufficientPermission')}
        >
          <Icon name="mic" className="h-7 w-7" />
        </button>

        <button
          type="button"
          onClick={() => openCreateTask(selectedDate)}
          disabled={!canWriteActiveCalendar}
          className="aura-fab h-16 w-16"
          aria-label={canWriteActiveCalendar ? t('common.createTask') : t('sharing.insufficientPermission')}
        >
          <Icon name="plus" className="h-9 w-9" />
        </button>
      </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-2">
        <div className="aura-nav-shell mx-auto grid max-w-5xl grid-cols-5 gap-1 p-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.view === activeView || (item.view === 'today' && activeView === 'today');

            return (
              <button
                key={item.view}
                type="button"
                onClick={() => {
                  if (item.view === 'today') {
                    goToday();
                    return;
                  }

                  setActiveView(item.view);
                }}
                className={`relative rounded-2xl px-1 py-2 text-center text-[11px] font-bold transition ${
                  isActive
                    ? 'text-cyan-600 dark:text-cyan-200'
                    : 'text-slate-500 hover:bg-cyan-50/70 hover:text-cyan-700 dark:text-slate-400 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200'
                }`}
              >
                <span className="mx-auto grid h-7 w-7 place-items-center">
                  <Icon name={item.icon} className="h-6 w-6" />
                </span>
                <span className="mt-1 block truncate">{t(item.labelKey)}</span>
                {isActive ? <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_14px_rgba(34,211,238,0.9)]" /> : null}
              </button>
            );
          })}
        </div>
      </nav>

      {taskModal ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-slate-950/55 p-3 backdrop-blur-md sm:place-items-center">
          <section className="aura-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-[0_0_22px_rgba(34,211,238,0.18)] dark:bg-cyan-500/10 dark:text-cyan-200">
                  <Icon name="sparkles" className="h-6 w-6" />
                </span>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                  {taskModal.mode === 'edit' ? t('app.editTask') : t('app.newTask')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTaskModal(null)}
                className="aura-icon-button"
                aria-label={t('app.closeForm')}
              >
                <Icon name="close" className="h-6 w-6" />
              </button>
            </div>
            <TaskForm
              task={taskModal.task}
              initialValues={taskModal.initialValues}
              assistantNotice={taskModal.assistantNotice}
              suggestedTimes={taskModal.suggestedTimes}
              onCancel={() => setTaskModal(null)}
              onSubmit={handleTaskSubmit}
            />
          </section>
        </div>
      ) : null}

      {seriesAction ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-3 backdrop-blur-md sm:place-items-center">
          <section className="aura-panel w-full max-w-md p-5">
            <p className="aura-label">{t('app.series.title')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{seriesAction.task.title}</h2>
            <p className="aura-muted mt-3 text-sm leading-relaxed">{t('app.series.description')}</p>

            <div className="mt-5 space-y-3">
              {seriesAction.action === 'edit' ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="aura-secondary w-full text-sm text-slate-400 dark:text-slate-500"
                  >
                    {t('app.series.editOccurrencePending')}
                  </button>
                  <button
                    type="button"
                    onClick={() => editWholeSeries(seriesAction.task)}
                    className="aura-primary w-full text-sm"
                  >
                    {t('app.series.editSeries')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => deleteSingleOccurrence(seriesAction.task)}
                    className="aura-danger w-full text-sm"
                  >
                    {t('app.series.deleteOccurrence')}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWholeSeries(seriesAction.task)}
                    className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700"
                  >
                    {t('app.series.deleteSeries')}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSeriesAction(null)}
                className="aura-secondary w-full text-sm"
              >
                {t('common.cancel')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AuraLogo() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <div className="aura-orb h-14 w-14 sm:h-16 sm:w-16" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[1.55rem] font-black leading-none tracking-[0.2em] text-slate-950 dark:text-white sm:text-[2rem] sm:tracking-[0.26em]">AURA</span>
          <Icon name="sparkles" className="h-5 w-5 shrink-0 text-cyan-400" />
        </div>
        <span className="block text-[0.62rem] font-semibold uppercase leading-none tracking-[0.42em] text-slate-700 dark:text-slate-200 sm:text-[0.7rem] sm:tracking-[0.55em]">
          Calendar
        </span>
      </div>
    </div>
  );
}

function StatsCard({ pending, completed }: { pending: number; completed: number }) {
  const { t } = useI18n();
  return (
    <section className="aura-card grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-4">
      <StatItem icon="calendar" value={pending} label={t('app.stats.pending')} />
      <div className="h-14 w-px bg-slate-300/70 dark:bg-slate-700/70" />
      <StatItem icon="check" value={completed} label={t('app.stats.completed')} />
    </section>
  );
}

function StatItem({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-cyan-400 text-cyan-600 shadow-[0_0_22px_rgba(34,211,238,0.22)] dark:text-cyan-200">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <span>
        <strong className="block text-3xl font-black leading-none text-slate-950 dark:text-white">{value}</strong>
        <span className="mt-1 block text-sm font-medium text-cyan-700 dark:text-cyan-300">{label}</span>
      </span>
    </div>
  );
}

function AssistantHero({ onMicClick, disabled = false }: { onMicClick: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="aura-card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-24 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <div className="aura-orb h-20 w-20" />
        <div className="min-w-0 flex-1">
          <p className="aura-label">{t('app.assistantHero.label')}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{t('app.assistantHero.title')}</h2>
          <p className="aura-muted mt-2 text-sm leading-relaxed">
            {t('app.assistantHero.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={onMicClick}
          disabled={disabled}
          className="aura-fab hidden h-20 w-20 shrink-0 sm:grid"
          aria-label={disabled ? t('sharing.insufficientPermission') : t('app.voiceCreate')}
        >
          <Icon name="mic" className="h-9 w-9" />
        </button>
      </div>
    </section>
  );
}
