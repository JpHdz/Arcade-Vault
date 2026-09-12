import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Development-only connection check for Supabase. It goes through the real
 * server client, so it exercises Next's env loading, `cookies()` and the
 * publishable key together. In production it answers 404 before touching
 * anything, so it never reveals whether the backend is reachable.
 */

type SupabaseHealth =
  | { configured: false; reachable: false }
  | { configured: true; reachable: true; latencyMs: number }
  | { configured: true; reachable: false; error: string };

const NO_STORE = { "Cache-Control": "no-store" };

function respond(body: SupabaseHealth, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function unreachable(message: string): Response {
  return respond(
    {
      configured: true,
      reachable: false,
      error: message || "Unknown Supabase error",
    },
    503,
  );
}

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404, headers: NO_STORE });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return respond({ configured: false, reachable: false }, 503);
  }

  try {
    // One real round trip that the API rejects when the key is invalid.
    const startedAt = performance.now();
    const { error } = await supabase.storage.listBuckets();
    const latencyMs = Math.round(performance.now() - startedAt);

    if (error) return unreachable(error.message);
    return respond({ configured: true, reachable: true, latencyMs }, 200);
  } catch (error) {
    return unreachable(error instanceof Error ? error.message : String(error));
  }
}
