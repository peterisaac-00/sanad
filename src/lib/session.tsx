import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiRequestError, type SessionPayload } from "./api";

interface SessionContextValue {
  session: SessionPayload | null;
  merchant: any | null;
  store: any | null;
  loading: boolean;
  refresh: () => Promise<SessionPayload | null>;
  setSession: (session: SessionPayload | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setSessionState(me);
      return me;
    } catch (err) {
      if (!(err instanceof ApiRequestError) || err.status !== 401) {
        // Network hiccups should still surface as signed-out, but they must not
        // leave the app in a permanent loading state.
      }
      setSessionState(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback((value: SessionPayload | null) => {
    setSessionState(value);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The cookie may already be expired; clearing local state is still correct.
    } finally {
      setSessionState(null);
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      merchant: session?.merchant ?? null,
      store: session?.store ?? null,
      loading,
      refresh,
      setSession,
      logout,
    }),
    [session, loading, refresh, setSession, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** Safe post-login redirect: only in-app absolute paths are accepted. */
export function safeNextPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
