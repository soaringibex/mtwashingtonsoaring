// Every Wx Brief datum, proxied and cached.
//
// Open-Meteo's free tier counts each requested location against shared per-IP budgets
// (600/minute, 5,000/hour, 10,000/day — fine for a non-commercial club site, and a cold
// page now fits in one minute's budget), so fetching from every visitor's browser spent
// ~400 of their own budget per load. Here the upstream API is fetched once per dataset
// per refresh window (the Data Cache) and the response is cached at the edge on top of
// that, so users only ever talk to us.

import { buildUpstreamRequest } from "@/lib/wx-datasets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> },
): Promise<Response> {
  const { dataset } = await params;
  const upstream = buildUpstreamRequest(dataset, new URL(request.url).searchParams);
  if (!upstream) {
    return Response.json({ error: "unknown dataset" }, { status: 404 });
  }

  const headers = {
    "Cache-Control": `public, s-maxage=${upstream.revalidate}, stale-while-revalidate=${upstream.revalidate * 2}`,
  };

  try {
    const responses = await Promise.all(
      upstream.urls.map((url) =>
        fetch(url, {
          next: { revalidate: upstream.revalidate },
          headers: { "User-Agent": "mtwashingtonsoaring.org weather dashboard" },
          signal: AbortSignal.timeout(20_000),
        }),
      ),
    );
    for (const response of responses) {
      if (!response.ok) throw new Error(`upstream ${response.status}`);
    }
    const payloads = (await Promise.all(responses.map((response) => response.json()))) as unknown[];

    if (upstream.elevationMerge) {
      const elevation = payloads.flatMap((payload) =>
        Array.isArray((payload as { elevation?: unknown }).elevation)
          ? ((payload as { elevation: number[] }).elevation)
          : [],
      );
      return Response.json({ elevation }, { headers });
    }
    if (upstream.locationsMerge) {
      const locations = payloads.flatMap((payload) => (Array.isArray(payload) ? payload : [payload]));
      return Response.json(locations, { headers });
    }
    return Response.json(payloads[0], { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "weather unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
