import { parseEnglishTaskCommand } from './englishTaskParser';

const REFERENCE_DATE = new Date(2026, 5, 9);

interface ParserExpectation {
  input: string;
  title: string;
  date: string;
  time: string;
  reminderEnabled?: boolean;
  reminderSilent?: boolean;
  reminderMinutesBefore?: number;
  recurrenceType?: string;
  recurrenceDaysOfWeek?: number[];
  recurrenceDaysOfMonth?: number[];
  recurrenceInterval?: number;
}

export const ENGLISH_TASK_PARSER_INTERNAL_CASES: ParserExpectation[] = [
  {
    input: 'tomorrow at 9 take medication with alarm',
    title: 'Take medication',
    date: '2026-06-10',
    time: '09:00',
    reminderEnabled: true,
    reminderMinutesBefore: 0,
  },
  {
    input: 'August 14 at 6 PM dentist in Cádiz with alarm 5 minutes before',
    title: 'Dentist in Cádiz',
    date: '2026-08-14',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 5,
  },
  {
    input: 'every Tuesday and Thursday at 6 PM training',
    title: 'Training',
    date: '2026-06-16',
    time: '18:00',
    recurrenceType: 'weekdays',
    recurrenceDaysOfWeek: [2, 4],
    recurrenceInterval: 1,
  },
  {
    input: 'take medication every other day at 9',
    title: 'Take medication',
    date: '2026-06-10',
    time: '09:00',
    recurrenceType: 'alternate-days',
    recurrenceInterval: 2,
  },
  {
    input: 'review invoices on the 15th of every month at 12',
    title: 'Review invoices',
    date: '2026-06-15',
    time: '12:00',
    recurrenceType: 'month-days',
    recurrenceDaysOfMonth: [15],
  },
  {
    input: 'notify me 30 minutes before training tomorrow at 6 PM',
    title: 'Training',
    date: '2026-06-10',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 30,
  },
  {
    input: 'Task: dentist in Cádiz. Date: August 14. Time: 6 PM. Alarm: yes.',
    title: 'Dentist in Cádiz',
    date: '2026-08-14',
    time: '18:00',
    reminderEnabled: true,
  },
  {
    input: '14 August at 18:00 dentist',
    title: 'Dentist',
    date: '2026-08-14',
    time: '18:00',
  },
  {
    input: 'every 3 days at 8 cardio',
    title: 'Cardio',
    date: '2026-06-10',
    time: '08:00',
    recurrenceType: 'custom-days',
    recurrenceInterval: 3,
  },
  {
    input: 'on the 1st and 15th of every month at 12 review invoices',
    title: 'Review invoices',
    date: '2026-07-01',
    time: '12:00',
    recurrenceType: 'month-days',
    recurrenceDaysOfMonth: [1, 15],
  },
  {
    input: 'tomorrow at quarter past six training without sound',
    title: 'Training',
    date: '2026-06-10',
    time: '06:15',
    reminderEnabled: true,
    reminderSilent: true,
  },
];

export function runEnglishTaskParserInternalTests() {
  return ENGLISH_TASK_PARSER_INTERNAL_CASES.map((testCase) => {
    const parsed = parseEnglishTaskCommand(testCase.input, { referenceDate: REFERENCE_DATE });
    const failures = [
      parsed.draft.title === testCase.title ? undefined : `title: ${parsed.draft.title}`,
      parsed.draft.date === testCase.date ? undefined : `date: ${parsed.draft.date}`,
      parsed.draft.time === testCase.time ? undefined : `time: ${parsed.draft.time}`,
      testCase.reminderEnabled === undefined || parsed.draft.reminderEnabled === testCase.reminderEnabled
        ? undefined
        : `reminderEnabled: ${parsed.draft.reminderEnabled}`,
      testCase.reminderSilent === undefined || parsed.draft.reminderSilent === testCase.reminderSilent
        ? undefined
        : `reminderSilent: ${parsed.draft.reminderSilent}`,
      testCase.reminderMinutesBefore === undefined || parsed.draft.reminderMinutesBefore === testCase.reminderMinutesBefore
        ? undefined
        : `reminderMinutesBefore: ${parsed.draft.reminderMinutesBefore}`,
      testCase.recurrenceType === undefined || parsed.draft.recurrenceType === testCase.recurrenceType
        ? undefined
        : `recurrenceType: ${parsed.draft.recurrenceType}`,
      testCase.recurrenceInterval === undefined || parsed.draft.recurrenceInterval === testCase.recurrenceInterval
        ? undefined
        : `recurrenceInterval: ${parsed.draft.recurrenceInterval}`,
      testCase.recurrenceDaysOfWeek === undefined ||
      parsed.draft.recurrenceDaysOfWeek?.join('|') === testCase.recurrenceDaysOfWeek.join('|')
        ? undefined
        : `recurrenceDaysOfWeek: ${parsed.draft.recurrenceDaysOfWeek?.join('|')}`,
      testCase.recurrenceDaysOfMonth === undefined ||
      parsed.draft.recurrenceDaysOfMonth?.join('|') === testCase.recurrenceDaysOfMonth.join('|')
        ? undefined
        : `recurrenceDaysOfMonth: ${parsed.draft.recurrenceDaysOfMonth?.join('|')}`,
    ].filter(Boolean);

    return {
      input: testCase.input,
      ok: failures.length === 0,
      failures,
      parsed,
    };
  });
}
