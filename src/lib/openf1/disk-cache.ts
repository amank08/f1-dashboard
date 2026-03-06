import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

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

export function diskCacheGet(key: string): unknown | null {
  try {
    const filePath = join(CACHE_DIR, keyToFilename(key));
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function diskCacheSet(key: string, data: unknown): void {
  try {
    ensureDir();
    const filePath = join(CACHE_DIR, keyToFilename(key));
    writeFileSync(filePath, JSON.stringify(data));
  } catch {
    // Disk write failed — not critical
  }
}
