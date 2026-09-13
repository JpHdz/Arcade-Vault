"use client";

import { useSyncExternalStore } from "react";

import { PLAYER_NAME_PATTERN } from "./player-name";

/**
 * The name the player last saved a score with. Once it is set, later runs are
 * saved automatically under it (SPEC 06). There is deliberately no way to
 * forget it from the UI; it lives until the browser storage is cleared.
 *
 * The stored value is untrusted: anything that fails `PLAYER_NAME_PATTERN`
 * reads as "no remembered name".
 */
export const REMEMBERED_NAME_KEY = "av_player_name";

const listeners = new Set<() => void>();

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

// A string snapshot is compared by value, so no caching is needed.
function getSnapshot(): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(REMEMBERED_NAME_KEY);
  } catch {
    // Storage unavailable (private mode, blocked cookies): nothing remembered.
  }
  return raw !== null && PLAYER_NAME_PATTERN.test(raw) ? raw : null;
}

// The server knows nothing about the browser; the stored name appears right
// after hydration, so the markup never mismatches.
function getServerSnapshot(): string | null {
  return null;
}

/** The remembered player name, or null when there is none (or it is invalid). */
export function useRememberedName(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Remembers a name that was just used to save a score. */
export function rememberPlayerName(name: string): void {
  if (!PLAYER_NAME_PATTERN.test(name)) return;
  try {
    localStorage.setItem(REMEMBERED_NAME_KEY, name);
  } catch {
    // Nothing to persist; the next run simply asks again.
  }
  emit();
}
