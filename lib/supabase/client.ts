import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Supabase client for code that runs in the browser (Client Components).
 *
 * Returns `null` when Supabase is not configured, so every caller has to handle
 * the degraded branch. No client is built at module scope; `@supabase/ssr`
 * itself reuses a single browser instance across calls.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
