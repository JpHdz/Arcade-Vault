import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Supabase client authenticated with the secret key. It bypasses Row Level
 * Security, so it is used only to insert scores from the `submitScore` Server
 * Action; every read goes through the publishable key instead.
 *
 * `server-only` turns any import from a Client Component into a build error.
 * The key is read without a `NEXT_PUBLIC_` prefix, so Next never inlines it
 * into the browser bundle.
 *
 * Returns `null` when the URL or the secret key is missing. A new client is
 * built on every call, with session persistence off: there is no user session
 * on the server.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !secretKey) return null;

  return createClient<Database>(config.url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
