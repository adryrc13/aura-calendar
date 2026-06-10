import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseRuntimeConfig {
  url?: string;
  anonKey?: string;
  isConfigured: boolean;
  missingKeys: string[];
}

export const supabaseRuntimeConfig: SupabaseRuntimeConfig = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim(),
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
  isConfigured: Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()),
  missingKeys: [
    import.meta.env.VITE_SUPABASE_URL?.trim() ? undefined : 'VITE_SUPABASE_URL',
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ? undefined : 'VITE_SUPABASE_ANON_KEY',
  ].filter((key): key is string => Boolean(key)),
};

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseRuntimeConfig.isConfigured || !supabaseRuntimeConfig.url || !supabaseRuntimeConfig.anonKey) {
    return null;
  }

  supabaseClient ??= createClient(supabaseRuntimeConfig.url, supabaseRuntimeConfig.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return supabaseClient;
}

export function supabaseConfigurationLabel() {
  return supabaseRuntimeConfig.isConfigured ? 'Supabase configurado' : 'Supabase no configurado';
}
