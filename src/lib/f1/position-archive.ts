/**
 * Decode F1's static live-timing archive for a session's Position.z stream.
 *
 * F1 publishes every session's live-timing data as static files under
 * https://livetiming.formula1.com/static/... . The Position.z.jsonStream
 * file is a newline-delimited stream of zlib-compressed position updates
 * at ~4 Hz. This module fetches and decodes it into LocationSample[] so
 * the replay view can consume it identically to OpenF1's /location
 * endpoint (which has been zeroed out on the free tier).
 *
 * Line format (after stripping the leading UTF-8 BOM):
 *   HH:MM:SS.mmm"<base64 raw-deflate payload>"\r\n
 *
 * Decompressed payload (JSON):
 *   {
 *     "Position": [
 *       {
 *         "Timestamp": "2024-03-02T15:01:23.456Z",
 *         "Entries": {
 *           "1": { "Status": "OnTrack", "X": 123, "Y": 456, "Z": 789 },
 *           ...
 *         }
 *       },
 *       ...
 *     ]
 *   }
 *
 * Server-side only — uses Node's `zlib`.
 */
import { inflateRaw } from "zlib";
import { promisify } from "util";
import type { LocationSample } from "@/lib/openf1/types";

const inflateRawAsync = promisify(inflateRaw);

interface PositionPayload {
  Position?: Array<{
    Timestamp?: string;
    Entries?: Record<
      string,
      { Status?: string; X?: number; Y?: number; Z?: number }
    >;
  }>;
}

/**
 * Fetch and decode a Position.z.jsonStream archive into LocationSample[]
 * matching the shape of OpenF1's /location response.
 */
export async function fetchPositionArchive(
  archiveUrl: string,
  sessionKey: number,
  meetingKey: number
): Promise<LocationSample[]> {
  const res = await fetch(archiveUrl);
  if (!res.ok) {
    throw new Error(
      `F1 archive fetch failed: ${res.status} ${res.statusText} (${archiveUrl})`
    );
  }
  const text = await res.text();
  // Strip UTF-8 BOM if present.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const samples: LocationSample[] = [];
  // Lines are terminated by \r\n. Split and drop empties.
  const lines = body.split("\r\n");

  for (const line of lines) {
    if (line.length < 14) continue; // too short to contain a payload
    // Timestamp is the first 12 chars (HH:MM:SS.mmm). The remainder is
    // `"<base64>"`, with surrounding double-quotes. We only need the
    // base64 payload; absolute timestamps live inside the decoded JSON.
    const rest = line.slice(12);
    if (rest.length < 3 || rest[0] !== '"') continue;
    const closingQuote = rest.lastIndexOf('"');
    if (closingQuote <= 0) continue;
    const b64 = rest.slice(1, closingQuote);
    if (!b64) continue;

    let payload: PositionPayload;
    try {
      const buf = Buffer.from(b64, "base64");
      const inflated = await inflateRawAsync(buf);
      payload = JSON.parse(inflated.toString("utf-8")) as PositionPayload;
    } catch {
      continue; // skip malformed lines rather than aborting the whole stream
    }

    const positions = payload.Position;
    if (!Array.isArray(positions)) continue;
    for (const frame of positions) {
      const ts = frame.Timestamp;
      const entries = frame.Entries;
      if (!ts || !entries) continue;
      for (const [numStr, entry] of Object.entries(entries)) {
        const driverNumber = Number(numStr);
        if (!Number.isFinite(driverNumber)) continue;
        // Skip pit/garage samples — they have Status != "OnTrack" and
        // typically X/Y = 0. The processor doesn't distinguish, so we
        // drop them to keep the normalisation bounds tight.
        if (entry.Status && entry.Status !== "OnTrack") continue;
        const x = entry.X ?? 0;
        const y = entry.Y ?? 0;
        const z = entry.Z ?? 0;
        if (x === 0 && y === 0) continue;
        samples.push({
          session_key: sessionKey,
          meeting_key: meetingKey,
          driver_number: driverNumber,
          date: ts,
          x,
          y,
          z,
        });
      }
    }
  }

  return samples;
}
