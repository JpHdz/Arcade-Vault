"use client";

import { useSyncExternalStore } from "react";

/* ===== shared minute clock =====
 * One interval serves every mounted TimeAgo. The snapshot is a cached
 * timestamp that only moves on a tick, so it stays stable between reads.
 */

const REFRESH_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let now = 0;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const listener of listeners) listener();
    }, REFRESH_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  if (now === 0) now = Date.now();
  return now;
}

// The server renders nothing, so the cached page never freezes a relative
// time and hydration never sees a mismatch; the label appears right after.
function getServerSnapshot(): number | null {
  return null;
}

function label(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "AHORA";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Relative time since `at` (an ISO timestamp), refreshed every minute. */
export function TimeAgo({ at }: { at: string }) {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  if (current === null) return null;

  const elapsed = Math.max(0, current - Date.parse(at));
  return <time dateTime={at}>{label(elapsed)}</time>;
}
