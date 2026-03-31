import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/openf1/rate-limiter";
import { cache, getCacheTTL } from "@/lib/openf1/cache";
import { diskCacheGet, diskCacheSet } from "@/lib/openf1/disk-cache";

const BASE_URL = "https://api.openf1.org/v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  const { endpoint } = await params;
  const path = endpoint.join("/");
  const searchParams = request.nextUrl.searchParams;
  const cacheKey = `${path}?${searchParams.toString()}`;

  // Check in-memory cache
  const cached = cache.get(cacheKey);
  if (cached && !cached.isStale) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // Check disk cache before rate-limiting (avoids queuing for data we already have)
  const ttl = getCacheTTL(endpoint[0]);
  const diskData = diskCacheGet(cacheKey);
  if (diskData) {
    cache.set(cacheKey, diskData, ttl);
    return NextResponse.json(diskData, {
      headers: { "X-Cache": "DISK" },
    });
  }

  // Rate limit then fetch from OpenF1
  await rateLimiter.acquire();

  const url = `${BASE_URL}/${path}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    // Serve stale in-memory cache
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: { "X-Cache": "STALE" },
      });
    }

    // No cached data at all — return the error
    let errorMessage = `OpenF1 API error: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) errorMessage = body.detail;
    } catch {}

    return NextResponse.json(
      { error: errorMessage },
      { status: response.status }
    );
  }

  const data = await response.json();

  // Cache in memory and on disk
  cache.set(cacheKey, data, ttl);
  diskCacheSet(cacheKey, data);

  const ttlSeconds = Math.floor(ttl / 1000);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
      "X-Cache": "MISS",
    },
  });
}
