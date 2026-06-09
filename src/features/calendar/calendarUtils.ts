import type { Task } from '../../domain/tasks/task';
import { expandTasksInRange } from '../../domain/tasks/recurrence';
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
  const lastGridDay = addDays(firstGridDay, totalDays - 1);
  const today = toDateInputValue(new Date());
  const visibleTasks = expandTasksInRange(tasks, {
    start: toDateInputValue(firstGridDay),
    end: toDateInputValue(lastGridDay),
  });

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(firstGridDay, index);
    const value = toDateInputValue(date);

    return {
      date,
      value,
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: value === today,
      tasks: visibleTasks.filter((task) => task.date === value),
    };
  });
}

export function tasksForDate(tasks: Task[], date: string) {
  return expandTasksInRange(tasks, { start: date, end: date }).sort((a, b) => a.time.localeCompare(b.time));
}

export function upcomingTasks(tasks: Task[]) {
  const today = toDateInputValue(new Date());
  const horizon = toDateInputValue(addDays(new Date(), 90));
  return expandTasksInRange(tasks, { start: today, end: horizon }).sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
  );
}
