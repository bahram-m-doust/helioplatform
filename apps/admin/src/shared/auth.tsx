/**
 * Supabase Auth context. Wraps the @supabase/supabase-js client and
 * exposes session / sign-in / sign-out to the rest of the admin app.
 *
 * Replaces the old localStorage stub at
 * apps/main-app/frontend/src/features/auth/AuthContext.tsx with a real
 * auth flow. Email + password is the simplest path; magic-link is also
 * supported via signInWithOtp.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL } from './config';

interface AuthContextValue {
  client: SupabaseClient | null;
  session: Session | null;
  ready: boolean;
  configured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo<SupabaseClient | null>(() => {
    if (!SUPABASE_CONFIGURED) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!SUPABASE_CONFIGURED);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setReady(true);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  const signInWithPassword = async (email: string, password: string) => {
    if (!client) throw new Error('Supabase not configured.');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string) => {
    if (!client) throw new Error('Supabase not configured.');
    const { error } = await client.auth.signInWithOtp({ email });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!client) return;
    await client.auth.signOut();
  };

  const value: AuthContextValue = {
    client,
    session,
    ready,
    configured: SUPABASE_CONFIGURED,
    signInWithPassword,
    signInWithMagicLink,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be inside <AuthProvider>');
  return ctx;
}
