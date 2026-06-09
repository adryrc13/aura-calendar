import { parseSpanishTaskCommand } from './spanishTaskParser';

const REFERENCE_DATE = new Date(2026, 5, 9);

interface ParserExpectation {
  input: string;
  title: string;
  date: string;
  time: string;
  reminderEnabled?: boolean;
  reminderSilent?: boolean;
  reminderMinutesBefore?: number;
}

export const SPANISH_TASK_PARSER_INTERNAL_CASES: ParserExpectation[] = [
  {
    input: '2 de agosto dentista en Cádiz a las 6 de la tarde con alarma',
    title: 'Dentista en Cádiz',
    date: '2026-08-02',
    time: '18:00',
    reminderEnabled: true,
    reminderSilent: false,
    reminderMinutesBefore: 0,
  },
  {
    input: '2 de agosto a las 18 dentista en Cádiz',
    title: 'Dentista en Cádiz',
    date: '2026-08-02',
    time: '18:00',
  },
  {
    input: 'mañana a las 9 tomar medicación con alarma',
    title: 'Tomar medicación',
    date: '2026-06-10',
    time: '09:00',
    reminderEnabled: true,
    reminderMinutesBefore: 0,
  },
  {
    input: 'mañana a las 9 tomar medicación sin sonido',
    title: 'Tomar medicación',
    date: '2026-06-10',
    time: '09:00',
    reminderEnabled: true,
    reminderSilent: true,
  },
  {
    input: 'martes 9 dentista en Cádiz a las 18',
    title: 'Dentista en Cádiz',
    date: '2026-06-09',
    time: '18:00',
  },
  {
    input: 'el 15 de septiembre revisar facturas a las 12',
    title: 'Revisar facturas',
    date: '2026-09-15',
    time: '12:00',
  },
  {
    input: 'tarea dentista en Cádiz fecha 2 de agosto hora 18 alarma sí',
    title: 'Dentista en Cádiz',
    date: '2026-08-02',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 0,
  },
  {
    input: 'avísame 30 minutos antes de entrenar mañana a las 18',
    title: 'Entrenar',
    date: '2026-06-10',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 30,
  },
  {
    input: 'pasado mañana a las 8 sacar la basura',
    title: 'Sacar la basura',
    date: '2026-06-11',
    time: '08:00',
  },
  {
    input: 'el día 1 de enero a las 10 revisar objetivos',
    title: 'Revisar objetivos',
    date: '2027-01-01',
    time: '10:00',
  },
  {
    input: 'dentista en Cádiz 14 de agosto a las 6 de la tarde activar recordatorio 5 minutos antes',
    title: 'Dentista en Cádiz',
    date: '2026-08-14',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 5,
    reminderSilent: false,
  },
  {
    input: 'dentista en Cádiz 8 de agosto a las 6 de la tarde con alarma 5 minutos antes',
    title: 'Dentista en Cádiz',
    date: '2026-08-08',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 5,
    reminderSilent: false,
  },
  {
    input: 'dentista en Cádiz el 8 de agosto a las 18 con alarma 30 minutos antes',
    title: 'Dentista en Cádiz',
    date: '2026-08-08',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 30,
    reminderSilent: false,
  },
  {
    input: 'mañana a las 9 tomar medicación con alarma 10 minutos antes sin sonido',
    title: 'Tomar medicación',
    date: '2026-06-10',
    time: '09:00',
    reminderEnabled: true,
    reminderMinutesBefore: 10,
    reminderSilent: true,
  },
  {
    input: 'Tarea: dentista en Cádiz. Fecha: 14 de agosto. Hora: 18:00. Alarma: sí. Recordatorio: 5 minutos antes.',
    title: 'Dentista en Cádiz',
    date: '2026-08-14',
    time: '18:00',
    reminderEnabled: true,
    reminderMinutesBefore: 5,
    reminderSilent: false,
  },
  {
    input: 'recuérdame 1 hora antes revisar facturas el 15 de septiembre a las 12',
    title: 'Revisar facturas',
    date: '2026-09-15',
    time: '12:00',
    reminderEnabled: true,
    reminderMinutesBefore: 60,
  },
];

export function runSpanishTaskParserInternalTests() {
  return SPANISH_TASK_PARSER_INTERNAL_CASES.map((testCase) => {
    const parsed = parseSpanishTaskCommand(testCase.input, { referenceDate: REFERENCE_DATE });
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
      testCase.reminderMinutesBefore === undefined ||
      parsed.draft.reminderMinutesBefore === testCase.reminderMinutesBefore
        ? undefined
        : `reminderMinutesBefore: ${parsed.draft.reminderMinutesBefore}`,
    ].filter(Boolean);

    return {
      input: testCase.input,
      ok: failures.length === 0,
      failures,
      parsed,
    };
  });
}
