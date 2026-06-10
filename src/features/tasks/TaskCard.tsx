import type { Task } from '../../domain/tasks/task';
import { TASK_COLORS } from '../../domain/tasks/task';
import { recurrenceLabel } from '../../domain/tasks/recurrence';
import { Icon } from '../../shared/icons';
import { AttachmentList } from './TaskAttachments';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleCompleted: (task: Task) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleCompleted }: TaskCardProps) {
  const color = TASK_COLORS.find((item) => item.value === task.color) ?? TASK_COLORS[0];

  return (
    <article className="aura-card p-4 transition hover:-translate-y-0.5 hover:border-cyan-400/60">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onToggleCompleted(task)}
          className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition ${
            task.completed
              ? 'border-cyan-400 bg-cyan-500 text-white shadow-[0_0_18px_rgba(34,211,238,0.45)]'
              : 'border-cyan-400/70 text-transparent hover:border-cyan-300 hover:text-cyan-400 dark:border-cyan-300/70'
          }`}
          aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          <Icon name="check" className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700/70 dark:text-cyan-200/70">
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
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm"
              style={{ background: color.swatch, color: color.textColor }}
            >
              {color.label}
            </span>
          </div>

          {task.description ? (
            <p className="aura-muted mt-2 text-sm leading-relaxed">{task.description}</p>
          ) : null}

          <div className="aura-muted mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {task.recurrenceType && task.recurrenceType !== 'none' ? (
              <span className="aura-chip">
                {recurrenceLabel(task)}
              </span>
            ) : null}
            {task.reminderEnabled ? (
              <span className="aura-chip">
                Alarma {task.reminderMinutesBefore} min antes{task.reminderSilent ? ' · sin sonido' : ''}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100/80 px-3 py-1 dark:bg-slate-800/70">Sin alarma</span>
            )}
          </div>

          <AttachmentList attachments={task.attachments ?? []} compact />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="aura-secondary px-4 py-2 text-sm"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="aura-danger px-4 py-2 text-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
