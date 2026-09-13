import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Cookie-less Supabase client authenticated with the publishable key, for
 * public reads on the server. Unlike `createSupabaseServerClient`, it never
 * calls `cookies()`, so it is safe inside an `unstable_cache` scope. Row Level
 * Security applies as for any anonymous visitor.
 *
 * Returns `null` when Supabase is not configured. A new client is built on
 * every call, with session persistence off.
 */
export function createSupabasePublicClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
