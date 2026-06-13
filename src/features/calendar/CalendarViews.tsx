import type { Task } from '../../domain/tasks/task';
import { addDays, addMonths, formatMonthTitle, formatShortDate, formatWeekdayShort, parseInputDate, todayInputValue } from '../../shared/date';
import { Icon } from '../../shared/icons';
import { useI18n } from '../../shared/i18n';
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
  const { language, t } = useI18n();
  const days = buildMonthGrid(monthDate, tasks);
  const selectedTasks = tasksForDate(tasks, selectedDate);

  return (
    <section className="space-y-5">
      <CalendarToolbar
        title={formatMonthTitle(monthDate, language)}
        onPrevious={() => onChangeMonth(addMonths(monthDate, -1))}
        onNext={() => onChangeMonth(addMonths(monthDate, 1))}
        onToday={() => {
          const today = todayInputValue();
          onChangeMonth(new Date());
          onSelectDate(today);
        }}
      />

      <div className="aura-card p-3">
        <div className="grid grid-cols-7 px-1 pb-2 text-center text-[11px] font-black uppercase tracking-wide text-cyan-700/70 dark:text-cyan-200/70">
          {weekHeaders(language).map((day) => (
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
                className={`min-h-20 rounded-2xl border p-2 text-left transition ${
                  isSelected
                    ? 'border-cyan-300 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                    : day.isCurrentMonth
                      ? 'border-cyan-500/10 bg-white/60 text-slate-900 hover:border-cyan-300 hover:bg-cyan-50/80 dark:bg-slate-950/35 dark:text-slate-100 dark:hover:bg-cyan-500/10'
                      : 'border-transparent bg-slate-100/60 text-slate-400 dark:bg-slate-950/45 dark:text-slate-600'
                }`}
                aria-label={t('calendar.viewDay', { date: day.value })}
              >
                <span
                  className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                    day.isToday && !isSelected ? 'bg-cyan-100 text-cyan-700 shadow-[0_0_16px_rgba(34,211,238,0.2)] dark:bg-cyan-500/20 dark:text-cyan-200' : ''
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
        title={formatShortDate(selectedDate, language)}
        emptyText={t('calendar.emptyDay')}
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
  const { language, t } = useI18n();
  const selectedTasks = tasksForDate(tasks, selectedDate);
  const currentDate = parseInputDate(selectedDate);

  return (
    <section className="space-y-5">
      <CalendarToolbar
        title={formatShortDate(selectedDate, language)}
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
                className={`rounded-3xl border px-3 py-4 text-center transition ${
                  isSelected
                    ? 'border-cyan-300 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'border-cyan-500/10 bg-white/60 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/80 dark:bg-slate-950/35 dark:text-slate-200 dark:hover:bg-cyan-500/10'
                }`}
              >
                <span className="block text-xs font-bold uppercase tracking-wide">
                  {formatWeekdayShort(date, language)}
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
          <EmptyState text={t('calendar.freeDay')} onCreate={() => onCreateTask(selectedDate)} />
        )}
      </div>
    </section>
  );
}

interface AgendaViewProps extends CalendarCallbacks {
  tasks: Task[];
}

export function AgendaView({ tasks, onCreateTask, onEditTask, onDeleteTask, onToggleTask }: AgendaViewProps) {
  const { language, t } = useI18n();
  const agendaTasks = upcomingTasks(tasks);

  return (
    <section className="space-y-5">
      <div className="aura-card p-5">
        <p className="aura-label">{t('agenda.title')}</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{t('agenda.heading')}</h2>
        <p className="aura-muted mt-2 text-sm">
          {t('agenda.description')}
        </p>
      </div>

      {agendaTasks.length ? (
        <div className="space-y-3">
          {agendaTasks.map((task) => (
            <div key={task.id}>
              <p className="mb-2 ml-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700/70 dark:text-cyan-200/70">
                {formatShortDate(task.date, language)}
              </p>
              <TaskCard task={task} onEdit={onEditTask} onDelete={onDeleteTask} onToggleCompleted={onToggleTask} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={t('agenda.empty')} onCreate={() => onCreateTask()} />
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
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="aura-label">{t('calendar.selectedDay')}</p>
          <h2 className="mt-1 text-xl font-black capitalize text-slate-950 dark:text-white">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="aura-primary text-sm"
        >
          {t('common.create')}
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
  const { t } = useI18n();

  return (
    <div className="aura-card p-6 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-cyan-50 text-cyan-600 shadow-[0_0_24px_rgba(34,211,238,0.16)] dark:bg-cyan-500/10 dark:text-cyan-200">
        <Icon name="sparkles" className="h-8 w-8" />
      </div>
      <p className="aura-muted mt-4 text-sm">{text}</p>
      <button
        type="button"
        onClick={onCreate}
        className="aura-primary mt-4 text-sm"
      >
        {t('common.createTask')}
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
  const { t } = useI18n();

  return (
    <div className="aura-card p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevious}
          className="aura-icon-button"
          aria-label={t('common.previous')}
        >
          <Icon name="chevronLeft" className="h-6 w-6" />
        </button>
        <div className="text-center">
          <p className="aura-label">{t('nav.calendar')}</p>
          <h1 className="mt-1 text-xl font-black capitalize text-slate-950 dark:text-white">{title}</h1>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="aura-icon-button"
          aria-label={t('common.next')}
        >
          <Icon name="chevronRight" className="h-6 w-6" />
        </button>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="aura-primary mt-4 w-full text-sm"
      >
        {t('nav.today')}
      </button>
    </div>
  );
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

function weekHeaders(language: 'es' | 'en') {
  return language === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
}
