import type { Task } from '../../domain/tasks/task';
import { addDays, addMonths, formatShortDate, parseInputDate, todayInputValue, ES_MONTH_FORMATTER } from '../../shared/date';
import { TaskCard } from '../tasks/TaskCard';
import { buildMonthGrid, tasksForDate, upcomingTasks } from './calendarUtils';

interface CalendarCallbacks {
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onCreateTask: (date?: string) => void;
}

interface MonthViewProps extends CalendarCallbacks {
  monthDate: Date;
  selectedDate: string;
  tasks: Task[];
  onChangeMonth: (date: Date) => void;
  onSelectDate: (date: string) => void;
}

export function MonthView({
  monthDate,
  selectedDate,
  tasks,
  onChangeMonth,
  onSelectDate,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: MonthViewProps) {
  const days = buildMonthGrid(monthDate, tasks);
  const selectedTasks = tasksForDate(tasks, selectedDate);

  return (
    <section className="space-y-5">
      <CalendarToolbar
        title={ES_MONTH_FORMATTER.format(monthDate)}
        onPrevious={() => onChangeMonth(addMonths(monthDate, -1))}
        onNext={() => onChangeMonth(addMonths(monthDate, 1))}
        onToday={() => {
          const today = todayInputValue();
          onChangeMonth(new Date());
          onSelectDate(today);
        }}
      />

      <div className="aura-card p-3">
        <div className="grid grid-cols-7 px-1 pb-2 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isSelected = day.value === selectedDate;
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => onSelectDate(day.value)}
                onDoubleClick={() => onCreateTask(day.value)}
                className={`min-h-20 rounded-2xl p-2 text-left transition ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                    : day.isCurrentMonth
                      ? 'bg-white text-slate-900 hover:bg-violet-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-violet-500/10'
                      : 'bg-slate-100/80 text-slate-400 dark:bg-slate-950/80 dark:text-slate-600'
                }`}
                aria-label={`Ver día ${day.value}`}
              >
                <span
                  className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                    day.isToday && !isSelected ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200' : ''
                  }`}
                >
                  {day.date.getDate()}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {day.tasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className={`h-1.5 w-1.5 rounded-full ${task.completed ? 'bg-emerald-400' : 'bg-current'}`}
                    />
                  ))}
                  {day.tasks.length > 3 ? <span className="text-[10px] font-bold">+{day.tasks.length - 3}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <TaskList
        title={formatShortDate(selectedDate)}
        emptyText="No hay tareas para este día."
        tasks={selectedTasks}
        onCreate={() => onCreateTask(selectedDate)}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        onToggleTask={onToggleTask}
      />
    </section>
  );
}

interface DayViewProps extends CalendarCallbacks {
  selectedDate: string;
  tasks: Task[];
  onSelectDate: (date: string) => void;
}

export function DayView({
  selectedDate,
  tasks,
  onSelectDate,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: DayViewProps) {
  const selectedTasks = tasksForDate(tasks, selectedDate);
  const currentDate = parseInputDate(selectedDate);

  return (
    <section className="space-y-5">
      <CalendarToolbar
        title={formatShortDate(selectedDate)}
        onPrevious={() => onSelectDate(toDateValue(addDays(currentDate, -1)))}
        onNext={() => onSelectDate(toDateValue(addDays(currentDate, 1)))}
        onToday={() => onSelectDate(todayInputValue())}
      />

      <div className="aura-card p-4">
        <div className="grid grid-cols-3 gap-2">
          {[-1, 0, 1].map((offset) => {
            const date = addDays(currentDate, offset);
            const value = toDateValue(date);
            const isSelected = value === selectedDate;

            return (
              <button
                key={value}
                type="button"
                onClick={() => onSelectDate(value)}
                className={`rounded-3xl px-3 py-4 text-center transition ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                    : 'bg-slate-100 text-slate-700 hover:bg-violet-50 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="block text-xs font-bold uppercase tracking-wide">
                  {new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date)}
                </span>
                <span className="mt-1 block text-2xl font-black">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {selectedTasks.length ? (
          selectedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onToggleCompleted={onToggleTask}
            />
          ))
        ) : (
          <EmptyState text="Tu día está libre. Aprovechá para planificar con intención." onCreate={() => onCreateTask(selectedDate)} />
        )}
      </div>
    </section>
  );
}

interface AgendaViewProps extends CalendarCallbacks {
  tasks: Task[];
}

export function AgendaView({ tasks, onCreateTask, onEditTask, onDeleteTask, onToggleTask }: AgendaViewProps) {
  const agendaTasks = upcomingTasks(tasks);

  return (
    <section className="space-y-5">
      <div className="aura-card p-5">
        <p className="aura-label">Agenda</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Próximas tareas</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Acá ves lo que viene desde hoy en adelante, ordenado por fecha y hora.
        </p>
      </div>

      {agendaTasks.length ? (
        <div className="space-y-3">
          {agendaTasks.map((task) => (
            <div key={task.id}>
              <p className="mb-2 ml-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {formatShortDate(task.date)}
              </p>
              <TaskCard task={task} onEdit={onEditTask} onDelete={onDeleteTask} onToggleCompleted={onToggleTask} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="Todavía no hay tareas próximas." onCreate={() => onCreateTask()} />
      )}
    </section>
  );
}

interface TaskListProps {
  title: string;
  emptyText: string;
  tasks: Task[];
  onCreate: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
}

function TaskList({ title, emptyText, tasks, onCreate, onEditTask, onDeleteTask, onToggleTask }: TaskListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="aura-label">Día seleccionado</p>
          <h2 className="mt-1 text-xl font-black capitalize text-slate-950 dark:text-white">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25"
        >
          Crear
        </button>
      </div>
      {tasks.length ? (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onToggleCompleted={onToggleTask}
          />
        ))
      ) : (
        <EmptyState text={emptyText} onCreate={onCreate} />
      )}
    </div>
  );
}

interface EmptyStateProps {
  text: string;
  onCreate: () => void;
}

function EmptyState({ text, onCreate }: EmptyStateProps) {
  return (
    <div className="aura-card p-6 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-violet-100 text-3xl dark:bg-violet-500/10">✦</div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{text}</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
      >
        Crear tarea
      </button>
    </div>
  );
}

interface CalendarToolbarProps {
  title: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

function CalendarToolbar({ title, onPrevious, onNext, onToday }: CalendarToolbarProps) {
  return (
    <div className="aura-card p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevious}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xl font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          aria-label="Anterior"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="aura-label">Calendario</p>
          <h1 className="mt-1 text-xl font-black capitalize text-slate-950 dark:text-white">{title}</h1>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xl font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="mt-4 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-600"
      >
        Hoy
      </button>
    </div>
  );
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}
