/**
 * Supabase configuration shared by the browser and server clients.
 *
 * Both variables are read with literal `process.env.NEXT_PUBLIC_…` access so
 * Next can inline them into the browser bundle at build time; a dynamic lookup
 * would be `undefined` in the browser. Nothing here throws: a missing variable
 * means Supabase is not configured, and callers take the degraded branch. See
 * specs/.env.example for the variables involved.
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/** `null` when either variable is missing or blank. */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
