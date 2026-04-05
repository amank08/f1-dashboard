/**
 * Pipeline CLI dispatcher.
 *
 * Usage:
 *   npm run pipeline -- <job>
 *   npm run pipeline -- ingest-sessions
 *   npm run pipeline -- ingest-laps
 *   npm run pipeline -- all      # run every job, in dependency order
 *   npm run pipeline -- status   # show the last run of each job
 *
 * Jobs are intentionally plain async functions, not a framework. When the
 * number of jobs grows, we can introduce a small dependency graph here;
 * for now explicit ordering is clearer than abstraction.
 */
import { getDb } from "./db";
import { ingestSessions } from "./ingest-sessions";
import { ingestLaps } from "./ingest-laps";

type JobFn = () => Promise<number>;

const JOBS: Record<string, JobFn> = {
  "ingest-sessions": ingestSessions,
  "ingest-laps": ingestLaps,
};

const ORDER: string[] = ["ingest-sessions", "ingest-laps"];

async function main(): Promise<void> {
  const arg = process.argv[2];

  if (!arg || arg === "help" || arg === "--help" || arg === "-h") {
    printHelp();
    return;
  }

  if (arg === "status") {
    await printStatus();
    return;
  }

  if (arg === "all") {
    for (const name of ORDER) {
      console.log(`\n=== ${name} ===`);
      await JOBS[name]();
    }
    return;
  }

  const job = JOBS[arg];
  if (!job) {
    console.error(`Unknown job: ${arg}`);
    printHelp();
    process.exit(1);
  }
  await job();
}

function printHelp(): void {
  console.log(
    [
      "F1 pipeline",
      "",
      "Usage: npm run pipeline -- <job>",
      "",
      "Jobs:",
      ...Object.keys(JOBS).map((n) => `  ${n}`),
      "  all       run every job in order",
      "  status    show the last run of each job",
    ].join("\n")
  );
}

async function printStatus(): Promise<void> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(`
    SELECT job_name, target_key, status, started_at, finished_at, row_count, error
    FROM pipeline_runs
    QUALIFY row_number() OVER (
      PARTITION BY job_name, target_key
      ORDER BY started_at DESC
    ) = 1
    ORDER BY job_name, target_key
  `);
  const rows = result.getRowObjectsJson();
  if (rows.length === 0) {
    console.log("No pipeline runs recorded yet.");
    return;
  }
  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
