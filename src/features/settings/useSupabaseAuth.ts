import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, supabaseRuntimeConfig } from '../../infrastructure/supabase/supabaseClient';
import { useI18n } from '../../shared/i18n';

interface AuthResult {
  ok: boolean;
  message: string;
}

export function useSupabaseAuth() {
  const { t } = useI18n();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setIsLoadingSession(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsLoadingSession(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { ok: false, message: t('sync.supabaseNotConfigured') };

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) return { ok: false, message: error.message };
      return { ok: true, message: t('sync.sessionStarted') };
    },
    [supabase, t],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName?: string }): Promise<AuthResult> => {
      if (!supabase) return { ok: false, message: t('sync.supabaseNotConfigured') };

      const { error } = await supabase.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            full_name: input.fullName?.trim() || undefined,
          },
        },
      });

      if (error) return { ok: false, message: error.message };
      return { ok: true, message: t('sync.registerCreated') };
    },
    [supabase, t],
  );

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: t('sync.supabaseNotConfigured') };

    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: t('sync.sessionClosed') };
  }, [supabase, t]);

  return {
    isConfigured: supabaseRuntimeConfig.isConfigured,
    missingKeys: supabaseRuntimeConfig.missingKeys,
    isLoadingSession,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
  };
}
