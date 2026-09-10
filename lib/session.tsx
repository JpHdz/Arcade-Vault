"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface VaultUser {
  /** Uppercase, at most 10 characters. */
  name: string;
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

interface SessionValue {
  user: VaultUser | null;
  signIn: (user: VaultUser) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ===== external store over localStorage =====
 * The snapshot has to be referentially stable between reads or React would
 * re-render forever, so the parsed user is cached and only rebuilt when the
 * raw string actually changes.
 */

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedUser: VaultUser | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keeps other tabs in sync for free.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot(): VaultUser | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(USER_KEY);
  } catch {
    // Storage unavailable (private mode, blocked cookies): stay signed out.
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? (JSON.parse(raw) as VaultUser) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

// The server knows nothing about the browser, so it always renders signed out;
// React swaps in the stored session right after hydration.
function getServerSnapshot(): VaultUser | null {
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback((next: VaultUser) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
    } catch {
      // Nothing to persist; the sign in simply does not survive a reload.
    }
    emit();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
    emit();
  }, []);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    try {
      const all = readStored<SavedScore[]>(SCORES_KEY, []);
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {
      // Saved scores are decorative in this MVP; a failed write is silent.
    }
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signOut, saveScore }),
    [user, signIn, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside a SessionProvider");
  }
  return ctx;
}
