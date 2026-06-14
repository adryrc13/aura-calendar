import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createId } from '../../shared/id';
import { getSupabaseClient } from './supabaseClient';
import type { SupabaseCalendarRow } from './supabaseTaskMapper';
import {
  mapCalendarWithRole,
  mapCalendarsWithMemberships,
  permissionForRole,
  type CalendarInvitation,
  type CalendarInvitationRow,
  type CalendarMember,
  type CalendarMemberRow,
  type CalendarPermission,
  type InvitationRole,
  type InvitationStatus,
  type SharedCalendar,
} from './supabaseSharingModel';

export { permissionForRole } from './supabaseSharingModel';
export type {
  CalendarInvitation,
  CalendarInvitationRow,
  CalendarMember,
  CalendarMemberRow,
  CalendarPermission,
  CalendarRole,
  InvitationRole,
  InvitationStatus,
  SharedCalendar,
} from './supabaseSharingModel';

const ACTIVE_CALENDAR_STORAGE_PREFIX = 'aura-calendar:active-calendar:';
const ACTIVE_CALENDAR_EVENT = 'aura-calendar:active-calendar-change';

export const supabaseSharingRepository = {
  async listCalendars(client = requireSupabaseClient(), user?: User): Promise<SharedCalendar[]> {
    const currentUser = user ?? (await requireSupabaseUser(client));
    await ensurePersonalCalendar(client, currentUser);

    const { data: calendarRows, error: calendarError } = await client
      .from('calendars')
      .select('*')
      .order('created_at', { ascending: true });

    if (calendarError) {
      throw new Error(`No pudimos listar calendarios: ${calendarError.message}`);
    }

    const calendars = (calendarRows ?? []) as SupabaseCalendarRow[];
    if (!calendars.length) return [];

    const { data: memberRows, error: memberError } = await client
      .from('calendar_members')
      .select('*')
      .eq('user_id', currentUser.id)
      .in('calendar_id', calendars.map((calendar) => calendar.id));

    if (memberError) {
      throw new Error(`No pudimos leer membresias de calendarios: ${memberError.message}`);
    }

    return mapCalendarsWithMemberships(calendars, (memberRows ?? []) as CalendarMemberRow[], currentUser.id);
  },

  async getActiveCalendar(client = requireSupabaseClient(), user?: User): Promise<SharedCalendar> {
    const currentUser = user ?? (await requireSupabaseUser(client));
    const calendars = await this.listCalendars(client, currentUser);
    const storedId = getStoredActiveCalendarId(currentUser.id);
    const active =
      calendars.find((calendar) => calendar.id === storedId) ??
      calendars.find((calendar) => calendar.isOwner) ??
      calendars[0];

    if (!active) {
      const calendar = await ensurePersonalCalendar(client, currentUser);
      return mapCalendarWithRole(calendar, 'owner', currentUser.id)!;
    }

    storeActiveCalendarId(currentUser.id, active.id);
    return active;
  },

  async setActiveCalendar(calendarId: string, client = requireSupabaseClient(), user?: User) {
    const currentUser = user ?? (await requireSupabaseUser(client));
    const calendars = await this.listCalendars(client, currentUser);
    const active = calendars.find((calendar) => calendar.id === calendarId);

    if (!active) {
      throw new Error('No tenes acceso a ese calendario.');
    }

    storeActiveCalendarId(currentUser.id, active.id);
    notifyActiveCalendarChange(active.id);
    return active;
  },

  async listMembers(calendarId: string, client = requireSupabaseClient()): Promise<CalendarMember[]> {
    const { data, error } = await client
      .from('calendar_members')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`No pudimos listar miembros: ${error.message}`);
    }

    const members = (data ?? []) as CalendarMemberRow[];
    const profilesById = await listProfilesById(client, members.map((member) => member.user_id));

    return members.map((member) => mapMember(member, profilesById.get(member.user_id)));
  },

  async inviteUserByEmail(calendarId: string, invitedEmail: string, role: InvitationRole, client = requireSupabaseClient()) {
    const user = await requireSupabaseUser(client);
    const email = normalizeEmail(invitedEmail);

    const { data, error } = await client
      .from('calendar_invitations')
      .insert({
        calendar_id: calendarId,
        invited_email: email,
        invited_by: user.id,
        role,
        status: 'pending',
        token: createId(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`No pudimos crear la invitacion: ${error?.message ?? 'respuesta vacia'}`);
    }

    return mapInvitation(data as CalendarInvitationRow);
  },

  async listPendingInvitations(calendarId: string, client = requireSupabaseClient()): Promise<CalendarInvitation[]> {
    const { data, error } = await client
      .from('calendar_invitations')
      .select('*')
      .eq('calendar_id', calendarId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`No pudimos leer invitaciones pendientes: ${error.message}`);
    }

    return ((data ?? []) as CalendarInvitationRow[]).map(mapInvitation);
  },

  async listReceivedInvitations(client = requireSupabaseClient(), user?: User): Promise<CalendarInvitation[]> {
    const currentUser = user ?? (await requireSupabaseUser(client));
    const email = normalizeEmail(currentUser.email ?? '');

    if (!email) return [];

    const { data, error } = await client
      .from('calendar_invitations')
      .select('*')
      .eq('status', 'pending')
      .ilike('invited_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`No pudimos leer invitaciones recibidas: ${error.message}`);
    }

    const invitations = ((data ?? []) as CalendarInvitationRow[]).map(mapInvitation);
    const calendarNames = await listCalendarNamesById(client, invitations.map((invitation) => invitation.calendarId));

    return invitations.map((invitation) => ({
      ...invitation,
      calendarName: calendarNames.get(invitation.calendarId) ?? invitation.calendarName,
    }));
  },

  async cancelInvitation(invitationId: string, client = requireSupabaseClient()) {
    return updateInvitationStatus(client, invitationId, 'cancelled');
  },

  async rejectInvitation(invitationId: string, client = requireSupabaseClient()) {
    return updateInvitationStatus(client, invitationId, 'declined');
  },

  async acceptInvitation(invitation: Pick<CalendarInvitation, 'id' | 'calendarId' | 'role'>, client = requireSupabaseClient()) {
    const user = await requireSupabaseUser(client);
    const accepted = await updateInvitationStatus(client, invitation.id, 'accepted', new Date().toISOString());
    const { error } = await client.from('calendar_members').upsert(
      {
        calendar_id: invitation.calendarId,
        user_id: user.id,
        role: invitation.role,
      },
      { onConflict: 'calendar_id,user_id' },
    );

    if (error) {
      throw new Error(`La invitacion se acepto, pero no pudimos crear la membresia: ${error.message}`);
    }

    storeActiveCalendarId(user.id, invitation.calendarId);
    notifyActiveCalendarChange(invitation.calendarId);
    return accepted;
  },

  async changeMemberRole(memberId: string, role: InvitationRole, client = requireSupabaseClient()) {
    const { error } = await client.from('calendar_members').update({ role }).eq('id', memberId);

    if (error) {
      throw new Error(`No pudimos cambiar el rol: ${error.message}`);
    }
  },

  async removeMember(memberId: string, client = requireSupabaseClient()) {
    const { error } = await client.from('calendar_members').delete().eq('id', memberId);

    if (error) {
      throw new Error(`No pudimos eliminar el miembro: ${error.message}`);
    }
  },

  async checkPermission(calendarId: string, client = requireSupabaseClient(), user?: User): Promise<CalendarPermission | null> {
    const calendars = await this.listCalendars(client, user);
    const calendar = calendars.find((item) => item.id === calendarId);
    return calendar ? permissionForRole(calendar.role) : null;
  },
};

export function getStoredActiveCalendarId(userId: string) {
  return readLocalStorage(`${ACTIVE_CALENDAR_STORAGE_PREFIX}${userId}`);
}

export function subscribeActiveCalendarChange(listener: (calendarId: string) => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleEvent = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      listener(event.detail);
    }
  };

  window.addEventListener(ACTIVE_CALENDAR_EVENT, handleEvent);
  return () => window.removeEventListener(ACTIVE_CALENDAR_EVENT, handleEvent);
}

function mapMember(row: CalendarMemberRow, email?: string): CalendarMember {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    userId: row.user_id,
    role: row.role,
    email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvitation(row: CalendarInvitationRow): CalendarInvitation {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    invitedEmail: row.invited_email,
    invitedBy: row.invited_by,
    role: row.role,
    status: row.status,
    token: row.token ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.accepted_at ?? undefined,
  };
}

async function updateInvitationStatus(client: SupabaseClient, invitationId: string, status: Exclude<InvitationStatus, 'pending'>, acceptedAt?: string) {
  const { data, error } = await client
    .from('calendar_invitations')
    .update({
      status,
      accepted_at: status === 'accepted' ? acceptedAt ?? new Date().toISOString() : null,
    })
    .eq('id', invitationId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`No pudimos actualizar la invitacion: ${error?.message ?? 'respuesta vacia'}`);
  }

  return mapInvitation(data as CalendarInvitationRow);
}

async function listProfilesById(client: SupabaseClient, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const profilesById = new Map<string, string>();

  if (!uniqueUserIds.length) return profilesById;

  const { data, error } = await client.from('profiles').select('id,email').in('id', uniqueUserIds);
  if (error) return profilesById;

  for (const profile of (data ?? []) as Array<{ id: string; email: string | null }>) {
    if (profile.email) profilesById.set(profile.id, profile.email);
  }

  return profilesById;
}

async function listCalendarNamesById(client: SupabaseClient, calendarIds: string[]) {
  const uniqueCalendarIds = [...new Set(calendarIds)];
  const namesById = new Map<string, string>();

  if (!uniqueCalendarIds.length) return namesById;

  const { data, error } = await client.from('calendars').select('id,name').in('id', uniqueCalendarIds);
  if (error) return namesById;

  for (const calendar of (data ?? []) as Array<{ id: string; name: string }>) {
    namesById.set(calendar.id, calendar.name);
  }

  return namesById;
}

async function ensurePersonalCalendar(client: SupabaseClient, user: User): Promise<SupabaseCalendarRow> {
  const { data: calendars, error: readError } = await client
    .from('calendars')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (readError) {
    throw new Error(`No pudimos comprobar el calendario remoto: ${readError.message}`);
  }

  if (calendars?.length) {
    return calendars[0] as SupabaseCalendarRow;
  }

  const { data: createdCalendar, error: createError } = await client
    .from('calendars')
    .insert({
      owner_id: user.id,
      name: 'Personal',
      description: null,
      color: '#22d3ee',
    })
    .select('*')
    .single();

  if (createError || !createdCalendar) {
    throw new Error(`No pudimos crear el calendario remoto Personal: ${createError?.message ?? 'respuesta vacia'}`);
  }

  return createdCalendar as SupabaseCalendarRow;
}

function storeActiveCalendarId(userId: string, calendarId: string) {
  writeLocalStorage(`${ACTIVE_CALENDAR_STORAGE_PREFIX}${userId}`, calendarId);
}

function notifyActiveCalendarChange(calendarId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVE_CALENDAR_EVENT, { detail: calendarId }));
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('Supabase no configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }

  return client;
}

async function requireSupabaseUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(`No pudimos validar la sesion de Supabase: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('No hay sesion activa. Inicia sesion antes de usar calendarios compartidos.');
  }

  return data.user;
}

function readLocalStorage(key: string) {
  if (typeof localStorage === 'undefined') return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(key, value);
  } catch {
    // La app puede seguir con estado en memoria si localStorage falla.
  }
}
