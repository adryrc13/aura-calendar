import type { TaskAttachment } from './attachment';

export type TaskColor = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';

export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'alternate-days'
  | 'custom-days'
  | 'custom-weeks'
  | 'weekdays'
  | 'month-days';

export interface ModifiedOccurrence {
  title?: string;
  description?: string;
  time?: string;
  endTime?: string;
  completed?: boolean;
  color?: TaskColor;
  textColor?: string;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  reminderSilent?: boolean;
  deleted?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  endTime?: string;
  completed: boolean;
  color: TaskColor;
  textColor: string;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminderSilent: boolean;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceDaysOfWeek: number[];
  recurrenceDaysOfMonth: number[];
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceRule?: string;
  parentTaskId?: string;
  exceptionDates: string[];
  modifiedOccurrences: Record<string, ModifiedOccurrence>;
  attachments: TaskAttachment[];
  occurrenceDate?: string;
  sourceTaskId?: string;
  isVirtualOccurrence?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

export type TaskFormValues = Partial<TaskDraft> & Pick<TaskDraft, 'date' | 'time'>;

export const TASK_COLORS: Array<{ value: TaskColor; label: string; swatch: string; textColor: string }> = [
  { value: 'violet', label: 'Azul', swatch: '#2563eb', textColor: '#ffffff' },
  { value: 'cyan', label: 'Cian', swatch: '#22d3ee', textColor: '#0c1830' },
  { value: 'emerald', label: 'Verde', swatch: '#22c55e', textColor: '#052e16' },
  { value: 'amber', label: 'Naranja', swatch: '#f97316', textColor: '#111827' },
  { value: 'rose', label: 'Rosa', swatch: '#e11d48', textColor: '#ffffff' },
  { value: 'slate', label: 'Noche', swatch: '#334155', textColor: '#ffffff' },
];

export const RECURRENCE_TYPE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
  { value: 'none', label: 'Sin repetición' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
  { value: 'alternate-days', label: 'Días alternos' },
  { value: 'custom-days', label: 'Cada X días' },
  { value: 'custom-weeks', label: 'Cada X semanas' },
  { value: 'weekdays', label: 'Días fijos de la semana' },
  { value: 'month-days', label: 'Días concretos del mes' },
];

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'lunes' },
  { value: 2, label: 'martes' },
  { value: 3, label: 'miércoles' },
  { value: 4, label: 'jueves' },
  { value: 5, label: 'viernes' },
  { value: 6, label: 'sábado' },
  { value: 0, label: 'domingo' },
];

export const DEFAULT_TASK_DRAFT: Omit<TaskDraft, 'date' | 'time'> = {
  title: '',
  description: '',
  completed: false,
  color: 'cyan',
  textColor: '#0c1830',
  reminderEnabled: false,
  reminderMinutesBefore: 10,
  reminderSilent: false,
  recurrenceType: 'none',
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [],
  recurrenceDaysOfMonth: [],
  recurrenceEndDate: undefined,
  recurrenceCount: undefined,
  recurrenceRule: undefined,
  parentTaskId: undefined,
  exceptionDates: [],
  modifiedOccurrences: {},
  attachments: [],
  occurrenceDate: undefined,
  sourceTaskId: undefined,
  isVirtualOccurrence: undefined,
};
