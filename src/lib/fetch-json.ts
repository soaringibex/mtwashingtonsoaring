/**
 * fetch with a timeout and one retry — the weather endpoints occasionally
 * stall on a bad connection, and a stuck request should never leave the
 * page hanging on a spinner. A 429 gets a pause before the retry: the free
 * API counts locations against a per-minute budget, and repeating instantly
 * only deepens the penalty window.
 */
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const once = async () => {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      ...init,
    });
    if (!response.ok) throw new Error(`request failed: ${response.status}`);
    return response.json();
  };
  try {
    return await once();
  } catch (error) {
    if (error instanceof Error && error.message.includes("429")) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    return await once();
  }
}
