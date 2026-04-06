/**
 * bronze.laps ingest — one row per (session_key, driver_number, lap_number).
 *
 * Reads every `laps_session_key=*.json` file from the disk cache. Like
 * `ingest-sessions.ts`, this is offline: upserts whatever the cache
 * already holds. Fetching missing sessions is a separate concern.
 */
import {
  DuckDBTimestampMicrosecondsValue,
  type DuckDBConnection,
} from "@duckdb/node-api";
import { getDb, recordRun } from "./db";
import { readCacheEntries } from "./disk-cache-reader";
import type { LapData } from "../../src/lib/openf1/types";

const JOB_NAME = "ingest_laps";

export async function ingestLaps(): Promise<number> {
  const conn = await getDb();
  const startedAt = new Date();

  try {
    const entries = readCacheEntries<LapData[]>("laps_session_key=");
    console.log(
      `[${JOB_NAME}] found ${entries.length} cached laps files`
    );

    let written = 0;
    let sessionsTouched = 0;

    for (const entry of entries) {
      if (!Array.isArray(entry.data) || entry.data.length === 0) continue;
      sessionsTouched++;
      for (const lap of entry.data) {
        if (
          typeof lap?.session_key !== "number" ||
          typeof lap?.driver_number !== "number" ||
          typeof lap?.lap_number !== "number"
        ) {
          continue;
        }
        await upsertLap(conn, lap, entry.sourceKey);
        written++;
      }
    }

    await recordRun(conn, {
      jobName: JOB_NAME,
      targetKey: "all",
      status: "success",
      startedAt,
      rowCount: written,
    });
    console.log(
      `[${JOB_NAME}] upserted ${written} rows from ${sessionsTouched} sessions into bronze.laps`
    );
    return written;
  } catch (err) {
    await recordRun(conn, {
      jobName: JOB_NAME,
      targetKey: "all",
      status: "error",
      startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function upsertLap(
  conn: DuckDBConnection,
  lap: LapData,
  sourceKey: string
): Promise<void> {
  const prepared = await conn.prepare(`
    INSERT INTO bronze.laps
      (session_key, driver_number, lap_number, date_start, lap_duration,
       raw, source_key, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (session_key, driver_number, lap_number) DO UPDATE SET
      date_start   = excluded.date_start,
      lap_duration = excluded.lap_duration,
      raw          = excluded.raw,
      source_key   = excluded.source_key,
      ingested_at  = excluded.ingested_at
  `);
  prepared.bindInteger(1, lap.session_key);
  prepared.bindInteger(2, lap.driver_number);
  prepared.bindInteger(3, lap.lap_number);

  if (lap.date_start) {
    const ms = Date.parse(lap.date_start);
    if (Number.isFinite(ms)) {
      prepared.bindTimestamp(4, new DuckDBTimestampMicrosecondsValue(BigInt(ms) * 1000n));
    } else {
      prepared.bindNull(4);
    }
  } else {
    prepared.bindNull(4);
  }

  if (typeof lap.lap_duration === "number" && Number.isFinite(lap.lap_duration)) {
    prepared.bindDouble(5, lap.lap_duration);
  } else {
    prepared.bindNull(5);
  }

  prepared.bindVarchar(6, JSON.stringify(lap));
  prepared.bindVarchar(7, sourceKey);
  await prepared.run();
}
