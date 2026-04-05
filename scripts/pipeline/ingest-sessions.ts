/**
 * bronze.sessions ingest — loads every OpenF1 session we've ever cached
 * on disk into the bronze table, keyed by `session_key`.
 *
 * We prefer the `sessions_year=*.json` cache files because they're dense
 * (one file covers a whole season) and fall back to `sessions_meeting_key=*`
 * and `sessions_session_key=*` to fill gaps. Upsert semantics: if the same
 * session appears in multiple cache files we keep the most recently
 * ingested copy.
 *
 * This job is deliberately offline — no HTTP. Fetching missing years from
 * OpenF1 is a separate job to be added later (keeps ingest sources pure).
 */
import type { DuckDBConnection } from "@duckdb/node-api";
import { getDb, recordRun } from "./db";
import { readCacheEntries } from "./disk-cache-reader";
import type { Session } from "../../src/lib/openf1/types";

const JOB_NAME = "ingest_sessions";

export async function ingestSessions(): Promise<number> {
  const conn = await getDb();
  const startedAt = new Date();

  try {
    // Union of every session object we can find in the disk cache,
    // deduplicated by session_key with the latest mtime winning.
    const byKey = new Map<
      number,
      { session: Session; sourceKey: string; mtime: Date }
    >();

    // Order matters: year files are canonical, then meeting files, then
    // single-session files. Within each tier, the latest mtime wins.
    const tiers: Array<{ prefix: string }> = [
      { prefix: "sessions_year=" },
      { prefix: "sessions_meeting_key=" },
      { prefix: "sessions_session_key=" },
    ];

    for (const { prefix } of tiers) {
      const entries = readCacheEntries<Session[]>(prefix);
      for (const entry of entries) {
        if (!Array.isArray(entry.data)) continue;
        for (const session of entry.data) {
          if (!session || typeof session.session_key !== "number") continue;
          const existing = byKey.get(session.session_key);
          if (!existing || entry.mtime > existing.mtime) {
            byKey.set(session.session_key, {
              session,
              sourceKey: entry.sourceKey,
              mtime: entry.mtime,
            });
          }
        }
      }
    }

    console.log(
      `[${JOB_NAME}] collected ${byKey.size} unique sessions from disk cache`
    );

    let written = 0;
    for (const { session, sourceKey } of byKey.values()) {
      await upsertSession(conn, session, sourceKey);
      written++;
    }

    await recordRun(conn, {
      jobName: JOB_NAME,
      targetKey: "all",
      status: "success",
      startedAt,
      rowCount: written,
    });
    console.log(`[${JOB_NAME}] upserted ${written} rows into bronze.sessions`);
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

async function upsertSession(
  conn: DuckDBConnection,
  session: Session,
  sourceKey: string
): Promise<void> {
  // DuckDB supports `INSERT ... ON CONFLICT DO UPDATE`. We update every
  // column except `ingested_at`, which tracks the most recent write.
  const prepared = await conn.prepare(`
    INSERT INTO bronze.sessions
      (session_key, meeting_key, year, session_type, session_name,
       date_start, date_end, country_code, circuit_key,
       circuit_short_name, raw, source_key, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (session_key) DO UPDATE SET
      meeting_key        = excluded.meeting_key,
      year               = excluded.year,
      session_type       = excluded.session_type,
      session_name       = excluded.session_name,
      date_start         = excluded.date_start,
      date_end           = excluded.date_end,
      country_code       = excluded.country_code,
      circuit_key        = excluded.circuit_key,
      circuit_short_name = excluded.circuit_short_name,
      raw                = excluded.raw,
      source_key         = excluded.source_key,
      ingested_at        = excluded.ingested_at
  `);
  prepared.bindInteger(1, session.session_key);
  bindNullableInteger(prepared, 2, session.meeting_key);
  bindNullableInteger(prepared, 3, session.year);
  bindNullableVarchar(prepared, 4, session.session_type);
  bindNullableVarchar(prepared, 5, session.session_name);
  bindNullableTimestamp(prepared, 6, session.date_start);
  bindNullableTimestamp(prepared, 7, session.date_end);
  bindNullableVarchar(prepared, 8, session.country_code);
  bindNullableInteger(prepared, 9, session.circuit_key);
  bindNullableVarchar(prepared, 10, session.circuit_short_name);
  prepared.bindVarchar(11, JSON.stringify(session));
  prepared.bindVarchar(12, sourceKey);
  await prepared.run();
}

// --- small bind helpers ---

function bindNullableInteger(
  stmt: Awaited<ReturnType<DuckDBConnection["prepare"]>>,
  idx: number,
  value: number | null | undefined
) {
  if (value == null || !Number.isFinite(value)) stmt.bindNull(idx);
  else stmt.bindInteger(idx, value);
}

function bindNullableVarchar(
  stmt: Awaited<ReturnType<DuckDBConnection["prepare"]>>,
  idx: number,
  value: string | null | undefined
) {
  if (value == null) stmt.bindNull(idx);
  else stmt.bindVarchar(idx, value);
}

function bindNullableTimestamp(
  stmt: Awaited<ReturnType<DuckDBConnection["prepare"]>>,
  idx: number,
  value: string | null | undefined
) {
  if (!value) return stmt.bindNull(idx);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return stmt.bindNull(idx);
  stmt.bindTimestamp(idx, { micros: BigInt(ms) * 1000n });
}
