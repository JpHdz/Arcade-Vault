/**
 * Sliding-window rate limiter kept in the process's memory.
 *
 * Deliberately the simplest thing that stops a loop: the contact form's Server
 * Action is reachable by direct POST, and Resend's quota is finite. It is not a
 * durable limiter — the map dies with the process and each instance of a
 * multi-instance deployment counts on its own, so the effective allowance is
 * `LIMIT x instances`. Recorded as a risk in
 * specs/03-about-page-and-contact-email.md; a real limit needs shared storage.
 */

/** Length of the window, in milliseconds. */
const WINDOW_MS = 10 * 60 * 1000;

/** Calls allowed per key inside one window. */
const LIMIT = 3;

/** Timestamps of the recent calls, newest last, per key. */
const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  /** Calls still allowed in the current window. */
  remaining: number;
  /** When the window frees up again, as an epoch millisecond count. */
  retryAt: number;
}

/**
 * Drops timestamps that fell out of the window, for every key.
 *
 * Called on each check so keys that stopped being used are forgotten instead of
 * accumulating: without this the map would grow once per distinct IP, forever.
 */
function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  for (const [key, times] of hits) {
    const fresh = times.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      hits.delete(key);
    } else if (fresh.length !== times.length) {
      hits.set(key, fresh);
    }
  }
}

/**
 * Records one call against `key` and reports whether it is allowed.
 *
 * A rejected call is not recorded, so hammering the action cannot keep pushing
 * the window forward and lock the key out beyond `WINDOW_MS`.
 */
export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  prune(now);

  const times = hits.get(key) ?? [];
  if (times.length >= LIMIT) {
    return { ok: false, remaining: 0, retryAt: times[0] + WINDOW_MS };
  }

  times.push(now);
  hits.set(key, times);
  return {
    ok: true,
    remaining: LIMIT - times.length,
    retryAt: times[0] + WINDOW_MS,
  };
}

/** Clears every recorded call. Exists for tests and local debugging. */
export function resetRateLimit(): void {
  hits.clear();
}
