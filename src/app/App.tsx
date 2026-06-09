import { useMemo, useState } from 'react';
import type { Task, TaskDraft, TaskFormValues } from '../domain/tasks/task';
import { expandTasksInRange, isRecurringTask, isVirtualOccurrence } from '../domain/tasks/recurrence';
import { useReminderScheduler } from '../infrastructure/notifications/reminderScheduler';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { parseSpanishTaskCommand } from '../features/assistant/spanishTaskParser';
import { useVoiceRecognition } from '../features/assistant/useVoiceRecognition';
import { AgendaView, DayView, MonthView } from '../features/calendar/CalendarViews';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { TaskForm } from '../features/tasks/TaskForm';
import { useTasks } from '../features/tasks/useTasks';
import { addDays, parseInputDate, todayInputValue, toDateInputValue } from '../shared/date';
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

const NAV_ITEMS: Array<{ view: AppView; label: string; icon: string }> = [
  { view: 'today', label: 'Hoy', icon: '◎' },
  { view: 'calendar', label: 'Calendario', icon: '▦' },
  { view: 'agenda', label: 'Agenda', icon: '☰' },
  { view: 'assistant', label: 'Asistente', icon: '🎙️' },
  { view: 'settings', label: 'Ajustes', icon: '⚙' },
];

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { tasks, stats, isLoading, createTask, updateTask, deleteTask, deleteOccurrence, toggleTaskCompleted } = useTasks();
  const [activeView, setActiveView] = useState<AppView>('today');
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [monthDate, setMonthDate] = useState(new Date());
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [seriesAction, setSeriesAction] = useState<SeriesActionState | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('');

  const reminderTasks = useMemo(
    () =>
      expandTasksInRange(tasks, {
        start: todayInputValue(),
        end: toDateInputValue(addDays(new Date(), 31)),
      }),
    [tasks],
  );

  useReminderScheduler(reminderTasks);

  const selectedDateObject = useMemo(() => parseInputDate(selectedDate), [selectedDate]);
  const { startListening } = useVoiceRecognition({
    onTranscript: (transcript) => {
      const parsed = parseSpanishTaskCommand(transcript);
      const assistantNotice = parsed.confirmationReasons.join(' ');
      setActiveView('assistant');
      setVoiceStatus(
        parsed.confidence === 'complete'
          ? parsed.summary
          : `${parsed.summary} Confirmá: ${assistantNotice}`,
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
    const values =
      typeof initialValues === 'string'
        ? { date: initialValues, time: '09:00' }
        : (initialValues ?? { date: selectedDate, time: '09:00' });

    setTaskModal({ mode: 'create', initialValues: values, assistantNotice, suggestedTimes });
  }

  function openEditTask(task: Task) {
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

    const shouldDelete = window.confirm(`¿Eliminar “${task.title}”?`);
    if (!shouldDelete) return;
    await deleteTask(task.id);
  }

  async function deleteWholeSeries(task: Task) {
    const series = resolveSeriesTask(task);
    setSeriesAction(null);

    if (series) {
      await deleteTask(series.id);
    }
  }

  async function deleteSingleOccurrence(task: Task) {
    setSeriesAction(null);
    await deleteOccurrence(task);
  }

  function resolveSeriesTask(task: Task) {
    return task.sourceTaskId ? tasks.find((item) => item.id === task.sourceTaskId) : task;
  }

  function renderActiveView() {
    if (isLoading) {
      return (
        <div className="aura-card p-6 text-center text-sm font-bold text-slate-600 dark:text-slate-300">
          Cargando tareas locales…
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
          onToggleTask={toggleTaskCompleted}
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
          onToggleTask={toggleTaskCompleted}
        />
      );
    }

    if (activeView === 'assistant') {
      return (
        <AssistantPanel
          onCreateDraft={(parsed) =>
            openCreateTask(parsed.draft, parsed.confirmationReasons.join(' '), parsed.detected.suggestedTimes)
          }
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
        onToggleTask={toggleTaskCompleted}
      />
    );
  }

  return (
    <div className="min-h-screen pb-28 text-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={goToday} className="flex min-w-0 items-center gap-3 text-left">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-xl font-black text-white shadow-lg shadow-violet-600/25">
              A
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">
                Aura Calendar
              </p>
              <h1 className="truncate text-lg font-black text-slate-950 dark:text-white">
                {stats.pending} pendientes · {stats.completed} hechas
              </h1>
            </div>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-lg transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {voiceStatus ? (
          <div className="mb-4 rounded-3xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-800 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100">
            {voiceStatus}
          </div>
        ) : null}

        {renderActiveView()}
      </main>

      <button
        type="button"
        onClick={() => openCreateTask(selectedDate)}
        className="fixed bottom-24 right-4 z-30 grid h-16 w-16 place-items-center rounded-full bg-violet-600 text-3xl font-black text-white shadow-aura transition hover:scale-105 active:scale-95"
        aria-label="Crear tarea"
      >
        +
      </button>

      <button
        type="button"
        onClick={() =>
          startListening((message, status) => {
            setVoiceStatus(message);
            if (status === 'unsupported') {
              setActiveView('assistant');
            }
          })
        }
        className="fixed bottom-44 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-cyan-500 text-2xl text-white shadow-lg shadow-cyan-500/30 transition hover:scale-105 active:scale-95"
        aria-label="Crear tarea por voz"
      >
        🎙️
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/60 bg-white/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1">
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
                className={`rounded-2xl px-1 py-2 text-center text-[11px] font-black transition ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span className="block text-lg leading-none">{item.icon}</span>
                <span className="mt-1 block truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {taskModal ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-slate-950/55 p-3 backdrop-blur-sm sm:place-items-center">
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="aura-label">{taskModal.mode === 'edit' ? 'Editar tarea' : 'Nueva tarea'}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                  {taskModal.mode === 'edit' ? taskModal.task?.title : 'Planificá con intención'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTaskModal(null)}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-xl font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Cerrar formulario"
              >
                ×
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
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-3 backdrop-blur-sm sm:place-items-center">
          <section className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900">
            <p className="aura-label">Tarea recurrente</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{seriesAction.task.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Esta tarea pertenece a una serie. La estructura para ocurrencias individuales ya está preparada; en esta
              fase la edición parcial queda pendiente para no simular algo incompleto.
            </p>

            <div className="mt-5 space-y-3">
              {seriesAction.action === 'edit' ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  >
                    Editar solo esta ocurrencia — pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => editWholeSeries(seriesAction.task)}
                    className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25"
                  >
                    Editar toda la serie
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => deleteSingleOccurrence(seriesAction.task)}
                    className="w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    Eliminar solo esta ocurrencia
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWholeSeries(seriesAction.task)}
                    className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/25"
                  >
                    Eliminar toda la serie
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSeriesAction(null)}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
