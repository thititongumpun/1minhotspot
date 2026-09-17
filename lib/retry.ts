/**
 * Call `attempt` up to `attempts` times, sleeping `waitMs` between tries; the
 * first non-null result wins. Lives outside clips.ts so it is testable under
 * plain tsx (clips.ts's unstable_cache needs Next's incremental cache).
 */
export async function retryUntil<T>(attempt: () => Promise<T | null>, attempts: number, waitMs: number): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, waitMs));
    const result = await attempt();
    if (result !== null) return result;
  }
  return null;
}
