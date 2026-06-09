import type { Task, TaskDraft } from './task';
import { DEFAULT_TASK_DRAFT } from './task';
import { expandTaskOccurrences } from './recurrence';

function makeTask(overrides: Partial<TaskDraft> = {}): Task {
  return {
    ...DEFAULT_TASK_DRAFT,
    date: '2026-06-01',
    time: '09:00',
    title: 'Test',
    description: '',
    ...overrides,
    id: 'task-1',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function dates(task: Task, start = '2026-06-01', end = '2026-06-30') {
  return expandTaskOccurrences(task, { start, end }).map((occurrence) => occurrence.date);
}

export function runRecurrenceInternalTests() {
  const cases = [
    {
      name: 'repetición diaria',
      actual: dates(makeTask({ recurrenceType: 'daily' }), '2026-06-01', '2026-06-04'),
      expected: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'],
    },
    {
      name: 'semanal',
      actual: dates(makeTask({ recurrenceType: 'weekly' }), '2026-06-01', '2026-06-22'),
      expected: ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22'],
    },
    {
      name: 'mensual',
      actual: dates(makeTask({ recurrenceType: 'monthly' }), '2026-06-01', '2026-09-30'),
      expected: ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'],
    },
    {
      name: 'anual',
      actual: dates(makeTask({ recurrenceType: 'yearly' }), '2026-06-01', '2028-06-01'),
      expected: ['2026-06-01', '2027-06-01', '2028-06-01'],
    },
    {
      name: 'días alternos',
      actual: dates(makeTask({ recurrenceType: 'alternate-days' }), '2026-06-01', '2026-06-07'),
      expected: ['2026-06-01', '2026-06-03', '2026-06-05', '2026-06-07'],
    },
    {
      name: 'cada 3 días',
      actual: dates(makeTask({ recurrenceType: 'custom-days', recurrenceInterval: 3 }), '2026-06-01', '2026-06-10'),
      expected: ['2026-06-01', '2026-06-04', '2026-06-07', '2026-06-10'],
    },
    {
      name: 'martes y jueves',
      actual: dates(makeTask({ recurrenceType: 'weekdays', recurrenceDaysOfWeek: [2, 4] }), '2026-06-01', '2026-06-11'),
      expected: ['2026-06-02', '2026-06-04', '2026-06-09', '2026-06-11'],
    },
    {
      name: 'día 1 y 15 del mes',
      actual: dates(makeTask({ recurrenceType: 'month-days', recurrenceDaysOfMonth: [1, 15] }), '2026-06-01', '2026-07-16'),
      expected: ['2026-06-01', '2026-06-15', '2026-07-01', '2026-07-15'],
    },
    {
      name: 'fin por fecha',
      actual: dates(makeTask({ recurrenceType: 'daily', recurrenceEndDate: '2026-06-03' }), '2026-06-01', '2026-06-07'),
      expected: ['2026-06-01', '2026-06-02', '2026-06-03'],
    },
    {
      name: 'fin por número de ocurrencias',
      actual: dates(makeTask({ recurrenceType: 'daily', recurrenceCount: 3 }), '2026-06-01', '2026-06-07'),
      expected: ['2026-06-01', '2026-06-02', '2026-06-03'],
    },
    {
      name: 'excepción de una ocurrencia eliminada',
      actual: dates(makeTask({ recurrenceType: 'daily', exceptionDates: ['2026-06-02'] }), '2026-06-01', '2026-06-03'),
      expected: ['2026-06-01', '2026-06-03'],
    },
  ];

  return cases.map((testCase) => ({
    ...testCase,
    ok: testCase.actual.join('|') === testCase.expected.join('|'),
  }));
}
