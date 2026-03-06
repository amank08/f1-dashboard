#!/usr/bin/env node
/**
 * Seeds the disk cache with meeting/session metadata from the Jolpica (Ergast) API.
 * This provides fallback data when OpenF1 is locked during live sessions.
 *
 * Usage: node scripts/seed-fallback-cache.mjs
 *
 * Once the OpenF1 API unlocks, fresh data with real keys replaces this fallback.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache", "openf1");
const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
const YEARS = [2023, 2024, 2025, 2026];

function keyToFilename(key) {
  return key.replace(/[^a-zA-Z0-9_=-]/g, "_") + ".json";
}

function saveToDisk(key, data) {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  writeFileSync(join(CACHE_DIR, keyToFilename(key)), JSON.stringify(data));
}

// Circuit ID → OpenF1 circuit_short_name mapping
const CIRCUIT_MAP = {
  albert_park: "Albert Park",
  shanghai: "Shanghai",
  suzuka: "Suzuka",
  bahrain: "Bahrain",
  jeddah: "Jeddah",
  miami: "Miami",
  imola: "Imola",
  monaco: "Monaco",
  villeneuve: "Montreal",
  americas: "Austin",
  silverstone: "Silverstone",
  red_bull_ring: "Spielberg",
  hungaroring: "Hungaroring",
  spa: "Spa-Francorchamps",
  zandvoort: "Zandvoort",
  monza: "Monza",
  baku: "Baku",
  marina_bay: "Singapore",
  interlagos: "Interlagos",
  losail: "Losail",
  yas_marina: "Yas Marina",
  vegas: "Las Vegas",
  rodriguez: "Mexico City",
  Catalunya: "Barcelona",
  catalunya: "Barcelona",
};

function getCircuitShortName(circuitId) {
  return CIRCUIT_MAP[circuitId] ?? circuitId;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} — ${url}`);
  return res.json();
}

function makeDateTime(date, time) {
  return `${date}T${time || "00:00:00Z"}`;
}

async function main() {
  console.log("Seeding fallback cache from Jolpica API...\n");

  for (const year of YEARS) {
    process.stdout.write(`${year}: `);
    let races;
    try {
      const data = await fetchJSON(`${JOLPICA_BASE}/${year}.json`);
      races = data.MRData.RaceTable.Races;
      console.log(`${races.length} races`);
    } catch (e) {
      console.log(`error: ${e.message}`);
      continue;
    }

    // Build OpenF1-shaped meetings
    const meetings = races.map((race, i) => {
      const meetingKey = year * 100 + (i + 1);
      return {
        meeting_key: meetingKey,
        meeting_name: race.raceName.replace(" Grand Prix", " GP"),
        meeting_official_name: race.raceName,
        location: race.Circuit.Location.locality,
        country_key: i + 1,
        country_code: "",
        country_name: race.Circuit.Location.country,
        circuit_key: i + 1,
        circuit_short_name: getCircuitShortName(race.Circuit.circuitId),
        date_start: makeDateTime(race.date, race.time),
        date_end: makeDateTime(race.date, race.time),
        gmt_offset: "00:00:00",
        year,
        _fallback: true,
      };
    });

    saveToDisk(`meetings?year=${year}`, meetings);

    // Build sessions for each meeting
    for (let i = 0; i < races.length; i++) {
      const race = races[i];
      const meetingKey = year * 100 + (i + 1);
      const circuitShortName = getCircuitShortName(race.Circuit.circuitId);
      const sessions = [];
      let sessionIdx = 0;

      const addSession = (name, type, dateObj) => {
        if (!dateObj) return;
        sessionIdx++;
        sessions.push({
          session_key: meetingKey * 10 + sessionIdx,
          session_type: type,
          session_name: name,
          date_start: makeDateTime(dateObj.date, dateObj.time),
          date_end: makeDateTime(dateObj.date, dateObj.time),
          meeting_key: meetingKey,
          circuit_key: i + 1,
          circuit_short_name: circuitShortName,
          country_key: i + 1,
          country_code: "",
          country_name: race.Circuit.Location.country,
          location: race.Circuit.Location.locality,
          gmt_offset: "00:00:00",
          year,
          _fallback: true,
        });
      };

      addSession("Practice 1", "Practice", race.FirstPractice);
      if (race.SprintQualifying) {
        addSession("Sprint Qualifying", "Sprint Qualifying", race.SprintQualifying);
        addSession("Sprint", "Sprint", race.Sprint);
      } else {
        addSession("Practice 2", "Practice", race.SecondPractice);
        addSession("Practice 3", "Practice", race.ThirdPractice);
      }
      addSession("Qualifying", "Qualifying", race.Qualifying);
      addSession("Race", "Race", { date: race.date, time: race.time });

      saveToDisk(`sessions?meeting_key=${meetingKey}`, sessions);
      process.stdout.write(`  ${race.raceName}: ${sessions.length} sessions\n`);
    }
    console.log();
  }

  console.log("Done! Fallback cache saved to .cache/openf1/");
  console.log("Note: This uses placeholder keys. Real OpenF1 keys will replace them once the API unlocks.");
}

main().catch(console.error);
