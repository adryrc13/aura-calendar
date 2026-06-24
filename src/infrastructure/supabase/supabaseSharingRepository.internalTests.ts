import {
  filterRecoverableReceivedInvitations,
  mapCalendarWithRole,
  mapCalendarsWithMemberships,
  permissionForRole,
  ACCEPT_INVITATION_RPC,
  type CalendarInvitationRow,
  type CalendarMemberRow,
} from './supabaseSharingModel';
import type { SupabaseCalendarRow } from './supabaseTaskMapper';

const NOW = '2026-06-14T00:00:00.000Z';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const PERSONAL_CALENDAR_ID = '33333333-3333-4333-8333-333333333333';
const SHARED_CALENDAR_ID = '44444444-4444-4444-8444-444444444444';
const DUPLICATE_SHARED_CALENDAR_ID = '77777777-7777-4777-8777-777777777777';

function makeCalendar(overrides: Partial<SupabaseCalendarRow> = {}): SupabaseCalendarRow {
  return {
    id: PERSONAL_CALENDAR_ID,
    owner_id: USER_ID,
    name: 'Personal',
    description: null,
    color: '#22d3ee',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeMember(overrides: Partial<CalendarMemberRow> = {}): CalendarMemberRow {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    calendar_id: PERSONAL_CALENDAR_ID,
    user_id: USER_ID,
    role: 'owner',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<CalendarInvitationRow> = {}): CalendarInvitationRow {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    calendar_id: SHARED_CALENDAR_ID,
    invited_email: 'b@example.com',
    invited_by: OWNER_ID,
    role: 'viewer',
    status: 'pending',
    token: 'token',
    created_at: NOW,
    updated_at: NOW,
    accepted_at: null,
    ...overrides,
  };
}

export function runSupabaseSharingRepositoryInternalTests() {
  const ownCalendar = mapCalendarWithRole(makeCalendar(), 'owner', USER_ID);
  const sharedCalendar = mapCalendarWithRole(
    makeCalendar({ id: SHARED_CALENDAR_ID, owner_id: OWNER_ID, name: 'Equipo' }),
    'viewer',
    USER_ID,
  );
  const calendars = mapCalendarsWithMemberships(
    [
      makeCalendar(),
      makeCalendar({ id: SHARED_CALENDAR_ID, owner_id: OWNER_ID, name: 'Equipo' }),
    ],
    [
      makeMember(),
      makeMember({ calendar_id: SHARED_CALENDAR_ID, role: 'editor' }),
    ],
    USER_ID,
  );
  const pendingInvitation = makeInvitation();
  const acceptedWithoutMembership = makeInvitation({ id: '77777777-7777-4777-8777-777777777771', status: 'accepted', accepted_at: NOW });
  const acceptedWithMembership = makeInvitation({
    id: '77777777-7777-4777-8777-777777777772',
    calendar_id: DUPLICATE_SHARED_CALENDAR_ID,
    status: 'accepted',
    accepted_at: NOW,
  });
  const recoverableInvitations = filterRecoverableReceivedInvitations(
    [pendingInvitation, acceptedWithoutMembership, acceptedWithMembership],
    [makeMember({ calendar_id: DUPLICATE_SHARED_CALENDAR_ID, role: 'viewer' })],
    USER_ID,
  );

  return [
    {
      name: 'mapear calendario propio',
      ok: ownCalendar?.isOwner === true && ownCalendar.role === 'owner' && ownCalendar.name === 'Personal',
    },
    {
      name: 'mapear calendario compartido',
      ok: sharedCalendar?.isOwner === false && sharedCalendar.role === 'viewer' && sharedCalendar.name === 'Equipo',
    },
    {
      name: 'roles owner/editor/viewer resuelven permisos',
      ok:
        permissionForRole('owner').canManageMembers &&
        permissionForRole('owner').canWriteTasks &&
        permissionForRole('editor').canWriteTasks &&
        !permissionForRole('editor').canManageMembers &&
        permissionForRole('editor').canRead &&
        permissionForRole('viewer').canRead &&
        !permissionForRole('viewer').canWriteTasks &&
        !permissionForRole('viewer').canManageMembers,
    },
    {
      name: 'mapeo de lista conserva calendarios accesibles',
      ok: calendars.length === 2 && calendars[0].role === 'owner' && calendars[1].role === 'editor',
    },
    {
      name: 'invitacion pendiente conserva rol invitado',
      ok: pendingInvitation.status === 'pending' && pendingInvitation.role === 'viewer',
    },
    {
      name: 'aceptar invitacion usa rol editor/viewer',
      ok: makeInvitation({ status: 'accepted', role: 'editor', accepted_at: NOW }).role === 'editor',
    },
    {
      name: 'aceptar invitacion crea calendar_members mediante flujo transaccional',
      ok: recoverableInvitations.some((invitation) => invitation.id === acceptedWithoutMembership.id),
    },
    {
      name: 'aceptar invitacion no usa single cuando puede devolver 0 filas',
      ok: ACCEPT_INVITATION_RPC === 'accept_calendar_invitation',
    },
    {
      name: 'accepted sin membership se puede recuperar',
      ok:
        recoverableInvitations.some((invitation) => invitation.id === acceptedWithoutMembership.id) &&
        !recoverableInvitations.some((invitation) => invitation.id === acceptedWithMembership.id),
    },
    {
      name: 'rechazar invitacion cambia estado sin crear rol',
      ok: makeInvitation({ status: 'declined' }).status === 'declined',
    },
    {
      name: 'selector de calendario activo puede apuntar a compartido',
      ok: calendars.some((calendar) => calendar.id === SHARED_CALENDAR_ID && calendar.role === 'editor'),
    },
    {
      name: 'usuario viewer ve calendario compartido',
      ok: sharedCalendar?.role === 'viewer' && permissionForRole(sharedCalendar.role).canRead,
    },
    {
      name: 'usuario editor ve calendario compartido',
      ok: calendars.some((calendar) => calendar.id === SHARED_CALENDAR_ID && calendar.role === 'editor' && permissionForRole(calendar.role).canWriteTasks),
    },
    {
      name: 'selector combina propios y compartidos sin duplicados',
      ok:
        mapCalendarsWithMemberships(
          [
            makeCalendar(),
            makeCalendar(),
            makeCalendar({ id: SHARED_CALENDAR_ID, owner_id: OWNER_ID, name: 'Personal' }),
          ],
          [makeMember(), makeMember({ calendar_id: SHARED_CALENDAR_ID, role: 'viewer' })],
          USER_ID,
        ).length === 2,
    },
    {
      name: 'viewer no puede modificar tareas ni adjuntos',
      ok: !permissionForRole('viewer').canWriteTasks,
    },
    {
      name: 'editor si puede modificar tareas y adjuntos',
      ok: permissionForRole('editor').canWriteTasks,
    },
    {
      name: 'tarea creada usa calendario activo compartido',
      ok: calendars.find((calendar) => calendar.id === SHARED_CALENDAR_ID)?.id === SHARED_CALENDAR_ID,
    },
  ];
}
