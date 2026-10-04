/**
 * fetch with a timeout and one retry — the weather endpoints occasionally
 * stall on a bad connection, and a stuck request should never leave the
 * page hanging on a spinner.
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
  } catch {
    return await once();
  }
}
