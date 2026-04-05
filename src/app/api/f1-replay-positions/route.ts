import { NextRequest, NextResponse } from "next/server";
import { buildPositionArchiveUrl } from "@/lib/f1/archive-path";
import { fetchPositionArchive } from "@/lib/f1/position-archive";
import { diskCacheGet, diskCacheSet } from "@/lib/openf1/disk-cache";
import { rateLimiter } from "@/lib/openf1/rate-limiter";
import type { Meeting, Session, LocationSample } from "@/lib/openf1/types";

// Next.js runtime: Node only (needs zlib).
export const runtime = "nodejs";
// Decoding a full race archive can take 10-20 seconds on a cold fetch.
export const maxDuration = 60;

const OPENF1 = "https://api.openf1.org/v1";

/**
 * Fetch an OpenF1 endpoint, sharing the same disk cache key format the
 * main /api/f1 proxy uses so hits from either route reuse each other's
 * cached data. Rate-limits on cold fetches.
 */
async function openf1<T>(path: string, query: string): Promise<T> {
  const cacheKey = `${path}?${query}`;
  const cached = diskCacheGet(cacheKey);
  if (cached) return cached as T;

  await rateLimiter.acquire();
  const res = await fetch(`${OPENF1}/${path}?${query}`);
  if (!res.ok) {
    throw new Error(
      `OpenF1 ${path}?${query} failed: ${res.status}`
    );
  }
  const data = (await res.json()) as T;
  diskCacheSet(cacheKey, data);
  return data;
}

export async function GET(request: NextRequest) {
  const sessionKeyParam = request.nextUrl.searchParams.get("session_key");
  const sessionKey = sessionKeyParam ? Number(sessionKeyParam) : NaN;
  if (!Number.isFinite(sessionKey)) {
    return NextResponse.json(
      { error: "session_key query param is required" },
      { status: 400 }
    );
  }

  // Disk cache: archive data is immutable for historical sessions.
  const cacheKey = `f1replaypos_session=${sessionKey}`;
  const cached = diskCacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "DISK" } });
  }

  try {
    // Resolve session → meeting → sibling sessions. These calls share the
    // on-disk cache with the main /api/f1 proxy, so they're usually hits.
    const sessions = await openf1<Session[]>(
      "sessions",
      `session_key=${sessionKey}`
    );
    const session = sessions[0];
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [meetings, meetingSessions] = await Promise.all([
      openf1<Meeting[]>("meetings", `meeting_key=${session.meeting_key}`),
      openf1<Session[]>("sessions", `meeting_key=${session.meeting_key}`),
    ]);
    const meeting = meetings[0];
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const archiveUrl = buildPositionArchiveUrl(
      session,
      meeting,
      meetingSessions
    );
    const samples: LocationSample[] = await fetchPositionArchive(
      archiveUrl,
      session.session_key,
      session.meeting_key
    );

    // Cache the decoded samples. These files can be several MB per race;
    // disk is fine, but we opt into the cache explicitly by prefixing the
    // key outside the `location` skip pattern.
    diskCacheSet(cacheKey, samples);

    return NextResponse.json(samples, {
      headers: {
        "X-Cache": "MISS",
        "X-Archive-Url": archiveUrl,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
