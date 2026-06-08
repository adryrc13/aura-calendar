import type { Task } from '../../domain/tasks/task';
import { addDays, endOfMonth, startOfMonth, toDateInputValue } from '../../shared/date';

export interface CalendarDay {
  date: Date;
  value: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
}

export function buildMonthGrid(monthDate: Date, tasks: Task[]): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const firstGridDay = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const totalDays = Math.ceil((((monthEnd.getTime() - firstGridDay.getTime()) / 86_400_000 + 1) / 7)) * 7;
  const today = toDateInputValue(new Date());

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(firstGridDay, index);
    const value = toDateInputValue(date);

    return {
      date,
      value,
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: value === today,
      tasks: tasks.filter((task) => task.date === value),
    };
  });
}

export function tasksForDate(tasks: Task[], date: string) {
  return tasks.filter((task) => task.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

export function upcomingTasks(tasks: Task[]) {
  const today = toDateInputValue(new Date());
  return tasks.filter((task) => task.date >= today).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
