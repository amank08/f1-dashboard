/**
 * DuckDB connection + schema bootstrap for the F1 data pipeline.
 *
 * Single local database at `data/f1.duckdb` with three schemas:
 *
 *   bronze  — raw ingested payloads, append/upsert only, source-of-truth
 *             for everything downstream. Keeps the original JSON alongside
 *             the fields we key on so re-deriving silver is always possible
 *             without re-fetching.
 *   silver  — typed, deduped, per-entity tables (one row per session,
 *             lap, driver, stint…). Added by later steps.
 *   gold    — analytics-ready marts and serving artifacts (replay
 *             snapshots, pace tables, …). Added by later steps.
 *
 * Plus a `pipeline_runs` table in the default schema that records every
 * job invocation so backfills and freshness checks are cheap to query.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export const DB_PATH = join(process.cwd(), "data", "f1.duckdb");

let instancePromise: Promise<DuckDBConnection> | null = null;

/**
 * Open (or create) the pipeline DB and ensure the schema exists. Subsequent
 * calls within the same process reuse the connection.
 */
export function getDb(): Promise<DuckDBConnection> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const instance = await DuckDBInstance.create(DB_PATH);
    const conn = await instance.connect();
    await bootstrap(conn);
    return conn;
  })();
  return instancePromise;
}

async function bootstrap(conn: DuckDBConnection): Promise<void> {
  await conn.run(`CREATE SCHEMA IF NOT EXISTS bronze`);
  await conn.run(`CREATE SCHEMA IF NOT EXISTS silver`);
  await conn.run(`CREATE SCHEMA IF NOT EXISTS gold`);

  // bronze.sessions — one row per OpenF1 session. Natural key: session_key.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS bronze.sessions (
      session_key   INTEGER PRIMARY KEY,
      meeting_key   INTEGER,
      year          INTEGER,
      session_type  VARCHAR,
      session_name  VARCHAR,
      date_start    TIMESTAMP,
      date_end      TIMESTAMP,
      country_code  VARCHAR,
      circuit_key   INTEGER,
      circuit_short_name VARCHAR,
      raw           JSON NOT NULL,
      source_key    VARCHAR NOT NULL,
      ingested_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // bronze.laps — one row per (session, driver, lap). Natural key is the
  // composite; we enforce it via a unique index so upserts are safe.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS bronze.laps (
      session_key   INTEGER NOT NULL,
      driver_number INTEGER NOT NULL,
      lap_number    INTEGER NOT NULL,
      date_start    TIMESTAMP,
      lap_duration  DOUBLE,
      raw           JSON NOT NULL,
      source_key    VARCHAR NOT NULL,
      ingested_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_key, driver_number, lap_number)
    )
  `);

  // pipeline_runs — one row per job invocation. `target_key` is free-form
  // (e.g. "year=2024" or "session_key=11234") so every job can pick a
  // granularity that matches its idempotency unit.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      job_name     VARCHAR NOT NULL,
      target_key   VARCHAR NOT NULL,
      status       VARCHAR NOT NULL,
      started_at   TIMESTAMP NOT NULL,
      finished_at  TIMESTAMP,
      row_count    INTEGER,
      error        VARCHAR
    )
  `);
}

/**
 * Record a pipeline run. Call with `status='success'` or `'error'` after
 * the job finishes; `started_at` is captured at the top of the job.
 */
export async function recordRun(
  conn: DuckDBConnection,
  params: {
    jobName: string;
    targetKey: string;
    status: "success" | "error";
    startedAt: Date;
    rowCount?: number;
    error?: string;
  }
): Promise<void> {
  const prepared = await conn.prepare(
    `INSERT INTO pipeline_runs
       (job_name, target_key, status, started_at, finished_at, row_count, error)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
  );
  prepared.bindVarchar(1, params.jobName);
  prepared.bindVarchar(2, params.targetKey);
  prepared.bindVarchar(3, params.status);
  prepared.bindTimestamp(4, { micros: BigInt(params.startedAt.getTime()) * 1000n });
  if (params.rowCount != null) prepared.bindInteger(5, params.rowCount);
  else prepared.bindNull(5);
  if (params.error != null) prepared.bindVarchar(6, params.error);
  else prepared.bindNull(6);
  await prepared.run();
}
