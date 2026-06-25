import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '../../shared/i18n';
import {
  subscribeActiveCalendarChange,
  supabaseSharingRepository,
  type CalendarInvitation,
  type CalendarMember,
  type InvitationRole,
  type SharedCalendar,
} from '../../infrastructure/supabase/supabaseSharingRepository';
import {
  getTaskRepositoryMode,
  subscribeTaskRepositoryModeChange,
  type TaskRepositoryMode,
} from '../../infrastructure/tasks/taskRepositoryProvider';
import { useSupabaseAuth } from './useSupabaseAuth';

export function SharedCalendarsPanel() {
  const { t } = useI18n();
  const { isConfigured, user } = useSupabaseAuth();
  const [repositoryMode, setRepositoryMode] = useState<TaskRepositoryMode>(() => getTaskRepositoryMode());
  const [calendars, setCalendars] = useState<SharedCalendar[]>([]);
  const [activeCalendar, setActiveCalendar] = useState<SharedCalendar | null>(null);
  const [members, setMembers] = useState<CalendarMember[]>([]);
  const [sentInvitations, setSentInvitations] = useState<CalendarInvitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<CalendarInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitationRole>('viewer');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isRemoteReady = repositoryMode === 'remote' && isConfigured && Boolean(user);
  const canManage = activeCalendar?.role === 'owner';

  useEffect(() => subscribeTaskRepositoryModeChange(setRepositoryMode), []);
  useEffect(() => subscribeActiveCalendarChange(() => void loadSharing()), [isRemoteReady]);

  useEffect(() => {
    if (isRemoteReady) {
      void loadSharing();
    } else {
      setCalendars([]);
      setActiveCalendar(null);
      setMembers([]);
      setSentInvitations([]);
      setReceivedInvitations([]);
    }
  }, [isRemoteReady]);

  async function loadSharing() {
    if (!isRemoteReady) return;

    setIsBusy(true);
    try {
      const [nextCalendars, nextActive, nextReceived] = await Promise.all([
        supabaseSharingRepository.listCalendars(),
        supabaseSharingRepository.getActiveCalendar(),
        supabaseSharingRepository.listReceivedInvitations(),
      ]);
      setCalendars(nextCalendars);
      setActiveCalendar(nextActive);
      setReceivedInvitations(nextReceived);

      if (nextActive) {
        const [nextMembers, nextSent] = await Promise.all([
          supabaseSharingRepository.listMembers(nextActive.id),
          supabaseSharingRepository.listPendingInvitations(nextActive.id),
        ]);
        setMembers(nextMembers);
        setSentInvitations(nextSent);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectCalendar(calendarId: string) {
    try {
      const nextActive = await supabaseSharingRepository.setActiveCalendar(calendarId);
      setActiveCalendar(nextActive);
      setMessage(t('sharing.activeCalendarChanged'));
      await loadSharing();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCalendar || !inviteEmail.trim()) return;

    setIsBusy(true);
    try {
      await supabaseSharingRepository.inviteUserByEmail(activeCalendar.id, inviteEmail, inviteRole);
      setInviteEmail('');
      setMessage(t('sharing.invitationCreated'));
      await loadSharing();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, successKey: string) {
    setIsBusy(true);
    try {
      await action();
      setMessage(t(successKey));
      await loadSharing();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (!isRemoteReady) {
    return (
      <div className="aura-card p-4">
        <p className="aura-label">{t('sharing.title')}</p>
        <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{t('sharing.sharedCalendars')}</h3>
        <p className="aura-muted mt-2 text-xs leading-relaxed">{t('sharing.enableRemoteToShare')}</p>
      </div>
    );
  }

  return (
    <div className="aura-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="aura-label">{t('sharing.title')}</p>
          <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{t('sharing.sharedCalendars')}</h3>
          <p className="aura-muted mt-1 text-xs">{t('sharing.description')}</p>
        </div>
        <button type="button" className="aura-secondary px-4 py-2 text-sm" onClick={loadSharing} disabled={isBusy}>
          {t('sharing.refresh')}
        </button>
      </div>

      <div className="mt-4">
        <label className="aura-label" htmlFor="active-calendar">
          {t('sharing.activeCalendar')}
        </label>
        <select
          id="active-calendar"
          className="aura-input mt-2 truncate text-sm"
          value={activeCalendar?.id ?? ''}
          onChange={(event) => void handleSelectCalendar(event.target.value)}
        >
          {calendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.name} · {calendar.isOwner ? t('sharing.personalCalendar') : t('sharing.sharedCalendar')} · {t(`sharing.role.${calendar.role}`)}
            </option>
          ))}
        </select>
      </div>

      {activeCalendar ? (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <Status label={t('sharing.currentCalendar')} value={activeCalendar.name} />
          <Status label={t('sharing.type')} value={activeCalendar.isOwner ? t('sharing.personalCalendar') : t('sharing.sharedCalendar')} />
          <Status label={t('sharing.role')} value={t(`sharing.role.${activeCalendar.role}`)} />
        </div>
      ) : null}

      {canManage && activeCalendar ? (
        <form onSubmit={handleInvite} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="aura-input"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder={t('sharing.invitedEmail')}
            required
          />
          <select className="aura-input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InvitationRole)}>
            <option value="viewer">{t('sharing.role.viewer')}</option>
            <option value="editor">{t('sharing.role.editor')}</option>
          </select>
          <button type="submit" className="aura-primary px-4 py-2 text-sm" disabled={isBusy}>
            {t('sharing.inviteUser')}
          </button>
        </form>
      ) : null}

      <Section title={t('sharing.members')}>
        {members.length ? (
          members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/10 bg-white/60 p-3 text-sm dark:bg-slate-950/35">
              <span className="min-w-0 flex-1 truncate font-bold text-slate-900 dark:text-white">{member.email ?? member.userId}</span>
              <div className="flex items-center gap-2">
                {canManage && member.role !== 'owner' ? (
                  <select
                    className="aura-input py-2 text-sm"
                    value={member.role}
                    onChange={(event) =>
                      void runAction(
                        () => supabaseSharingRepository.changeMemberRole(member.id, event.target.value as InvitationRole),
                        'sharing.roleChanged',
                      )
                    }
                  >
                    <option value="viewer">{t('sharing.role.viewer')}</option>
                    <option value="editor">{t('sharing.role.editor')}</option>
                  </select>
                ) : (
                  <span className="aura-chip">{t(`sharing.role.${member.role}`)}</span>
                )}
                {canManage && member.role !== 'owner' ? (
                  <button
                    type="button"
                    className="aura-danger px-3 py-2 text-sm"
                    onClick={() => void runAction(() => supabaseSharingRepository.removeMember(member.id), 'sharing.memberRemoved')}
                  >
                    {t('common.delete')}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="aura-muted text-sm">{t('sharing.emptyMembers')}</p>
        )}
      </Section>

      <Section title={t('sharing.pendingInvitations')}>
        {sentInvitations.length ? (
          sentInvitations.map((invitation) => (
            <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/10 bg-white/60 p-3 text-sm dark:bg-slate-950/35">
              <span className="min-w-0 flex-1 truncate font-bold text-slate-900 dark:text-white">
                {invitation.invitedEmail} · {t(`sharing.role.${invitation.role}`)}
              </span>
              {canManage ? (
                <button
                  type="button"
                  className="aura-secondary px-3 py-2 text-sm"
                  onClick={() => void runAction(() => supabaseSharingRepository.cancelInvitation(invitation.id), 'sharing.invitationCancelled')}
                >
                  {t('sharing.cancelInvitation')}
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="aura-muted text-sm">{t('sharing.emptyInvitations')}</p>
        )}
      </Section>

      <Section title={t('sharing.receivedInvitations')}>
        {receivedInvitations.length ? (
          receivedInvitations.map((invitation) => (
            <div key={invitation.id} className="rounded-2xl border border-cyan-500/10 bg-white/60 p-3 text-sm dark:bg-slate-950/35">
              <p className="font-bold text-slate-900 dark:text-white">
                {invitation.calendarName ?? t('sharing.sharedCalendar')} · {t(`sharing.role.${invitation.role}`)}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="aura-primary px-3 py-2 text-sm"
                  onClick={() => void runAction(() => supabaseSharingRepository.acceptInvitation(invitation), 'sharing.invitationAccepted')}
                >
                  {t('sharing.accept')}
                </button>
                {invitation.status === 'pending' ? (
                  <button
                    type="button"
                    className="aura-secondary px-3 py-2 text-sm"
                    onClick={() => void runAction(() => supabaseSharingRepository.rejectInvitation(invitation.id), 'sharing.invitationDeclined')}
                  >
                    {t('sharing.reject')}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="aura-muted text-sm">{t('sharing.emptyReceivedInvitations')}</p>
        )}
      </Section>

      {message ? <p className="aura-muted mt-4 text-sm font-semibold">{message}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <p className="aura-label">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-500/10 bg-white/60 px-3 py-2 dark:bg-slate-950/35">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700/70 dark:text-cyan-200/70">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
