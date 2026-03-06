#!/usr/bin/env node
/**
 * Pre-fetches OpenF1 meeting and session data and saves to disk cache.
 * Run this when the API is available to warm the cache for offline use:
 *   node scripts/preload-cache.mjs
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache", "openf1");
const BASE_URL = "https://api.openf1.org/v1";
const YEARS = [2023, 2024, 2025, 2026];

function keyToFilename(key) {
  return key.replace(/[^a-zA-Z0-9_=-]/g, "_") + ".json";
}

function isCached(key) {
  return existsSync(join(CACHE_DIR, keyToFilename(key)));
}

function saveToDisk(key, data) {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  writeFileSync(join(CACHE_DIR, keyToFilename(key)), JSON.stringify(data));
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt < retries) {
      const wait = 5000 * 2 ** attempt; // 5s, 10s, 20s
      process.stdout.write(`[429, retry in ${wait / 1000}s] `);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return res.json();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Preloading OpenF1 cache...\n");

  for (const year of YEARS) {
    const meetingsKey = `meetings?year=${year}`;
    process.stdout.write(`${year}: meetings... `);

    let meetings;
    try {
      meetings = await fetchWithRetry(`${BASE_URL}/meetings?year=${year}`);
      saveToDisk(meetingsKey, meetings);
      console.log(`${meetings.length} meetings`);
    } catch (e) {
      console.log(`error: ${e.message}`);
      continue;
    }

    for (const meeting of meetings) {
      const mk = meeting.meeting_key;
      const sessionsKey = `sessions?meeting_key=${mk}`;

      // Skip if sessions already cached
      if (isCached(sessionsKey)) {
        process.stdout.write(`  ${meeting.meeting_name}: cached\n`);
        continue;
      }

      process.stdout.write(`  ${meeting.meeting_name}: sessions... `);
      await sleep(2000);

      try {
        const sessions = await fetchWithRetry(`${BASE_URL}/sessions?meeting_key=${mk}`);
        saveToDisk(sessionsKey, sessions);
        console.log(`${sessions.length} sessions`);

        // Also cache drivers for each session
        for (const session of sessions) {
          const sk = session.session_key;
          const driversKey = `drivers?session_key=${sk}`;
          if (isCached(driversKey)) continue;

          await sleep(2000);
          try {
            const drivers = await fetchWithRetry(`${BASE_URL}/drivers?session_key=${sk}`);
            saveToDisk(driversKey, drivers);
          } catch {
            // skip — some sessions may not have driver data
          }
        }
      } catch (e) {
        console.log(`error: ${e.message}`);
      }
    }
    console.log();
  }

  console.log("Done! Cache saved to .cache/openf1/");
}

main().catch(console.error);
