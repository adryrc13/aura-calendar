import type { Task } from '../../domain/tasks/task';
import { TASK_COLORS } from '../../domain/tasks/task';
import { recurrenceLabel } from '../../domain/tasks/recurrence';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleCompleted: (task: Task) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleCompleted }: TaskCardProps) {
  const color = TASK_COLORS.find((item) => item.value === task.color) ?? TASK_COLORS[0];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onToggleCompleted(task)}
          className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${
            task.completed
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 text-transparent hover:border-violet-500 dark:border-slate-600'
          }`}
          aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          ✓
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {task.time}
                {task.endTime ? ` - ${task.endTime}` : ''}
              </p>
              <h3
                className={`mt-1 text-base font-black text-slate-950 dark:text-white ${
                  task.completed ? 'line-through opacity-55' : ''
                }`}
              >
                {task.title}
              </h3>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide"
              style={{ background: color.swatch, color: color.textColor }}
            >
              {color.label}
            </span>
          </div>

          {task.description ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{task.description}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {task.recurrenceType && task.recurrenceType !== 'none' ? (
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">
                {recurrenceLabel(task)}
              </span>
            ) : null}
            {task.reminderEnabled ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                Alarma {task.reminderMinutesBefore} min antes{task.reminderSilent ? ' · sin sonido' : ''}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Sin alarma</span>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-200"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
