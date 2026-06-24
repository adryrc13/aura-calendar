import type { SupabaseCalendarRow } from './supabaseTaskMapper';

export type CalendarRole = 'owner' | 'editor' | 'viewer';
export type InvitationRole = Exclude<CalendarRole, 'owner'>;
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export const ACCEPT_INVITATION_RPC = 'accept_calendar_invitation';

export interface CalendarMember {
  id: string;
  calendarId: string;
  userId: string;
  role: CalendarRole;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarInvitation {
  id: string;
  calendarId: string;
  invitedEmail: string;
  invitedBy: string;
  role: InvitationRole;
  status: InvitationStatus;
  token?: string;
  calendarName?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
}

export interface SharedCalendar {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  color?: string;
  role: CalendarRole;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarPermission {
  role: CalendarRole;
  canRead: boolean;
  canWriteTasks: boolean;
  canManageMembers: boolean;
  canDeleteCalendar: boolean;
}

export interface CalendarMemberRow {
  id: string;
  calendar_id: string;
  user_id: string;
  role: CalendarRole;
  created_at: string;
  updated_at: string;
}

export interface CalendarInvitationRow {
  id: string;
  calendar_id: string;
  invited_email: string;
  invited_by: string;
  role: InvitationRole;
  status: InvitationStatus;
  token: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
}

export function mapCalendarsWithMemberships(
  calendars: SupabaseCalendarRow[],
  members: CalendarMemberRow[],
  currentUserId: string,
): SharedCalendar[] {
  const roleByCalendarId = new Map(
    members.filter((member) => member.user_id === currentUserId).map((member) => [member.calendar_id, member.role]),
  );

  return uniqueCalendarsById(calendars)
    .map((calendar) => mapCalendarWithRole(calendar, roleByCalendarId.get(calendar.id) ?? (calendar.owner_id === currentUserId ? 'owner' : undefined), currentUserId))
    .filter((calendar): calendar is SharedCalendar => Boolean(calendar));
}

export function mapCalendarWithRole(calendar: SupabaseCalendarRow, role: CalendarRole | undefined, currentUserId: string): SharedCalendar | null {
  if (!role) return null;

  return {
    id: calendar.id,
    ownerId: calendar.owner_id,
    name: calendar.name,
    description: calendar.description ?? undefined,
    color: calendar.color ?? undefined,
    role,
    isOwner: role === 'owner' || calendar.owner_id === currentUserId,
    createdAt: calendar.created_at,
    updatedAt: calendar.updated_at,
  };
}

export function permissionForRole(role: CalendarRole): CalendarPermission {
  return {
    role,
    canRead: true,
    canWriteTasks: role === 'owner' || role === 'editor',
    canManageMembers: role === 'owner',
    canDeleteCalendar: role === 'owner',
  };
}

export function uniqueCalendarsById(calendars: SupabaseCalendarRow[]): SupabaseCalendarRow[] {
  const byId = new Map<string, SupabaseCalendarRow>();

  for (const calendar of calendars) {
    if (!byId.has(calendar.id)) {
      byId.set(calendar.id, calendar);
    }
  }

  return [...byId.values()];
}

export function filterRecoverableReceivedInvitations(
  invitations: CalendarInvitationRow[],
  memberships: CalendarMemberRow[],
  currentUserId: string,
): CalendarInvitationRow[] {
  const memberCalendarIds = new Set(
    memberships.filter((member) => member.user_id === currentUserId).map((member) => member.calendar_id),
  );

  return invitations.filter((invitation) => invitation.status === 'pending' || !memberCalendarIds.has(invitation.calendar_id));
}
