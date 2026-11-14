// Retries a flaky network step (such as signing in) a few times before giving up.

export async function withRetry<T>(
  run: () => Promise<T>,
  delaysMs: number[],
  retryable: (e: unknown) => boolean,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      if (attempt >= delaysMs.length || !retryable(e)) throw e;
      await wait(delaysMs[attempt]);
    }
  }
}

const NETWORK_CODES = new Set(['auth/network-request-failed', 'auth/internal-error', 'auth/timeout']);

export const errorCode = (e: unknown) => (typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '');

export const isNetworkError = (e: unknown) => NETWORK_CODES.has(errorCode(e));

/** A sync error in words a judge or crew member can act on. */
export function syncErrorMessage(e: unknown): string {
  if (isNetworkError(e)) {
    return "Could not reach the live sync service. Check this device's internet connection. Content blockers or a VPN can also block it.";
  }
  return e instanceof Error ? e.message : String(e);
}
