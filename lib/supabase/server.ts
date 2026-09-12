import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Supabase client for code that runs only on the server: Server Components,
 * Server Functions and Route Handlers. Never import this from a `"use client"`
 * module.
 *
 * Returns `null` when Supabase is not configured, so every caller has to handle
 * the degraded branch. A new client is built on every call, over the current
 * request's cookies; nothing is cached across requests.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; harmless until the auth spec adds proxy.ts to refresh sessions.
        }
      },
    },
  });
}
