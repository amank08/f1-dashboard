import { NextRequest, NextResponse } from "next/server";
import { buildPositionArchiveUrl } from "@/lib/f1/archive-path";
import { fetchPositionArchive } from "@/lib/f1/position-archive";
import {
  buildReplaySnapshot,
  type CircuitGeometry,
} from "@/lib/f1/replay-snapshot";
import { diskCacheGet, diskCacheSet } from "@/lib/openf1/disk-cache";
import { rateLimiter } from "@/lib/openf1/rate-limiter";
import type {
  Meeting,
  Session,
  LocationSample,
  ReplaySnapshot,
} from "@/lib/openf1/types";

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

/**
 * Fetch MultiViewer circuit geometry (cached on disk — circuit shapes
 * are immutable per year). Returns `undefined` if MV doesn't have it,
 * so the replay falls back to a track-less map.
 */
async function fetchCircuitGeometry(
  circuitKey: number,
  year: number
): Promise<CircuitGeometry | undefined> {
  const cacheKey = `mvcircuit_${circuitKey}_${year}`;
  const cached = diskCacheGet(cacheKey) as CircuitGeometry | undefined;
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${year}`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      x: number[];
      y: number[];
      rotation: number;
    };
    if (!Array.isArray(data.x) || !Array.isArray(data.y)) return undefined;
    const geom: CircuitGeometry = {
      x: data.x,
      y: data.y,
      rotation: data.rotation ?? 0,
    };
    diskCacheSet(cacheKey, geom);
    return geom;
  } catch {
    return undefined;
  }
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
  // Key is versioned ("snap") — the old `f1replaypos_session=` entries
  // held raw LocationSample[] which are now too large to ship to the
  // browser; ignore them and build the compact snapshot fresh.
  // "mv4" adds sectorPaths for flag-colored track overlays.
  const cacheKey = `f1replaysnapmv4_session=${sessionKey}`;
  const cached = diskCacheGet(cacheKey) as ReplaySnapshot | undefined;
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

    // Authoritative circuit outline from MultiViewer. We cache it under a
    // synthetic key so repeat requests (and other sessions at the same
    // circuit/year) hit disk. Failure is non-fatal — without it the map
    // still renders driver dots, just without the outline.
    const circuit = await fetchCircuitGeometry(
      session.circuit_key,
      meeting.year
    );

    const snapshot = buildReplaySnapshot(
      samples,
      circuit,
      session.circuit_short_name
    );
    diskCacheSet(cacheKey, snapshot);

    return NextResponse.json(snapshot, {
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
