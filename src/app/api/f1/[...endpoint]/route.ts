import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/openf1/rate-limiter";
import { cache, getCacheTTL } from "@/lib/openf1/cache";

const BASE_URL = "https://api.openf1.org/v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  const { endpoint } = await params;
  const path = endpoint.join("/");
  const searchParams = request.nextUrl.searchParams;
  const cacheKey = `${path}?${searchParams.toString()}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && !cached.isStale) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // Rate limit then fetch
  await rateLimiter.acquire();

  const url = `${BASE_URL}/${path}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    return NextResponse.json(
      { error: `OpenF1 API error: ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();

  // Cache with appropriate TTL
  const ttl = getCacheTTL(endpoint[0]);
  cache.set(cacheKey, data, ttl);

  const ttlSeconds = Math.floor(ttl / 1000);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
      "X-Cache": "MISS",
    },
  });
}
