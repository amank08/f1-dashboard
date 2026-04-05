import { NextRequest, NextResponse } from "next/server";
import { buildPositionArchiveUrl } from "@/lib/f1/archive-path";
import { fetchPositionArchive } from "@/lib/f1/position-archive";
import { diskCacheGet, diskCacheSet } from "@/lib/openf1/disk-cache";
import type { Meeting, Session, LocationSample } from "@/lib/openf1/types";

// Next.js runtime: Node only (needs zlib).
export const runtime = "nodejs";
// Decoding a full race archive can take 10-20 seconds on a cold fetch.
export const maxDuration = 60;

const OPENF1 = "https://api.openf1.org/v1";

async function openf1<T>(path: string): Promise<T> {
  const res = await fetch(`${OPENF1}/${path}`);
  if (!res.ok) {
    throw new Error(`OpenF1 ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
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
    // Resolve session → meeting → sibling sessions in parallel.
    const [sessions] = await Promise.all([
      openf1<Session[]>(`sessions?session_key=${sessionKey}`),
    ]);
    const session = sessions[0];
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [meetings, meetingSessions] = await Promise.all([
      openf1<Meeting[]>(`meetings?meeting_key=${session.meeting_key}`),
      openf1<Session[]>(`sessions?meeting_key=${session.meeting_key}`),
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
