export type TaskColor = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';

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
  createdAt: string;
  updatedAt: string;
}

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

export type TaskFormValues = Partial<TaskDraft> & Pick<TaskDraft, 'date' | 'time'>;

export const TASK_COLORS: Array<{ value: TaskColor; label: string; swatch: string; textColor: string }> = [
  { value: 'violet', label: 'Violeta', swatch: '#7c3aed', textColor: '#ffffff' },
  { value: 'cyan', label: 'Cian', swatch: '#0891b2', textColor: '#ffffff' },
  { value: 'emerald', label: 'Verde', swatch: '#059669', textColor: '#ffffff' },
  { value: 'amber', label: 'Ámbar', swatch: '#d97706', textColor: '#111827' },
  { value: 'rose', label: 'Rosa', swatch: '#e11d48', textColor: '#ffffff' },
  { value: 'slate', label: 'Pizarra', swatch: '#475569', textColor: '#ffffff' },
];

export const DEFAULT_TASK_DRAFT: Omit<TaskDraft, 'date' | 'time'> = {
  title: '',
  description: '',
  completed: false,
  color: 'violet',
  textColor: '#ffffff',
  reminderEnabled: false,
  reminderMinutesBefore: 10,
  reminderSilent: false,
};
