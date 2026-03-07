import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { getCacheTTL } from "./cache";

const CACHE_DIR = join(process.cwd(), ".cache", "openf1");

function ensureDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function keyToFilename(key: string): string {
  // Sanitize the cache key into a safe filename
  return key.replace(/[^a-zA-Z0-9_=-]/g, "_") + ".json";
}

/** Extract the endpoint name from a cache key like "laps?session_key=123" */
function endpointFromKey(key: string): string {
  return key.split(/[?_]/)[0];
}

export function diskCacheGet(key: string): unknown | null {
  try {
    const filePath = join(CACHE_DIR, keyToFilename(key));
    if (!existsSync(filePath)) return null;

    // Check file age against endpoint TTL
    const stat = statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ttl = getCacheTTL(endpointFromKey(key));
    if (ageMs > ttl) return null; // stale — force re-fetch

    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Skip disk-caching large per-driver location data (~4.5 MB each)
const SKIP_DISK_PATTERN = /^location\b/;

export function diskCacheSet(key: string, data: unknown): void {
  if (SKIP_DISK_PATTERN.test(key)) return;
  try {
    ensureDir();
    const filePath = join(CACHE_DIR, keyToFilename(key));
    writeFileSync(filePath, JSON.stringify(data));
  } catch {
    // Disk write failed — not critical
  }
}
