/**
 * "13/09/2026". Always UTC, so the server and the browser produce the same
 * string and the markup hydrates without mismatches.
 */
export function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

/** 0 → "0", 950 → "950", 21340 → "21.3K", 1250000 → "1.3M". */
export function formatPlays(n: number): string {
  if (n < 1000) return String(n);
  const thousands = (n / 1000).toFixed(1);
  // 999 950 rounds to "1000.0K"; show it as millions instead.
  if (n < 1_000_000 && Number(thousands) < 1000) return `${thousands}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
