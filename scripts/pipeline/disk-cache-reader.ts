/**
 * Read the existing `.cache/openf1/` lake as a bronze data source.
 *
 * The dashboard has been accumulating OpenF1 responses in this directory
 * for months — ~1k JSON files across every endpoint the app has ever
 * fetched. Rather than re-hit OpenF1 during backfill, the pipeline reads
 * straight from this cache. Each file is keyed by `<endpoint>_<params>`,
 * matching the `keyToFilename` scheme in `src/lib/openf1/disk-cache.ts`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache", "openf1");

export interface CacheEntry<T = unknown> {
  /** Sanitized cache key (also the filename minus `.json`). */
  sourceKey: string;
  /** Parsed JSON payload. */
  data: T;
  /** File mtime — the closest thing we have to an ingest timestamp. */
  mtime: Date;
}

/**
 * Enumerate every cache file whose sanitized key starts with `prefix`,
 * e.g. `"sessions_year="` for full-year session listings. Returns parsed
 * JSON; files that fail to parse are skipped with a warning.
 */
export function readCacheEntries<T = unknown>(
  prefix: string
): CacheEntry<T>[] {
  let names: string[];
  try {
    names = readdirSync(CACHE_DIR);
  } catch {
    return [];
  }

  const entries: CacheEntry<T>[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const sourceKey = name.slice(0, -".json".length);
    if (!sourceKey.startsWith(prefix)) continue;
    const filePath = join(CACHE_DIR, name);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as T;
      const mtime = statSync(filePath).mtime;
      entries.push({ sourceKey, data, mtime });
    } catch (err) {
      console.warn(`[disk-cache-reader] skip ${name}: ${(err as Error).message}`);
    }
  }
  return entries;
}
