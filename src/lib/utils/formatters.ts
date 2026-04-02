export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  }
  return secs.toFixed(3);
}

export function formatGap(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds === 0) return "LEADER";
  return `+${seconds.toFixed(3)}`;
}

export function formatSpeed(speed: number | null): string {
  if (speed === null || speed === undefined) return "—";
  return `${Math.round(speed)} km/h`;
}

export function formatPosition(position: number): string {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  return `${seconds.toFixed(1)}s`;
}

/** Convert an OpenF1 country_code (alpha-3 / non-standard) to ISO alpha-2. */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AUS: "AU", AUT: "AT", AZE: "AZ", BEL: "BE", BRA: "BR", BRN: "BH",
  CAN: "CA", CHN: "CN", ESP: "ES", GBR: "GB", HUN: "HU", ITA: "IT",
  JPN: "JP", KSA: "SA", MEX: "MX", MON: "MC", NED: "NL", QAT: "QA",
  SGP: "SG", UAE: "AE", USA: "US", FRA: "FR", POR: "PT", TUR: "TR",
  RSA: "ZA", ARE: "AE", SAU: "SA", MCO: "MC",
};

// Year-specific OpenF1 team_name → F1 CDN slug mappings.
// Team names and slugs changed across seasons.
const TEAM_CDN_SLUG_BY_YEAR: Record<number, Record<string, string>> = {
  2026: {
    "McLaren": "mclaren",
    "Red Bull Racing": "redbullracing",
    "Ferrari": "ferrari",
    "Mercedes": "mercedes",
    "Aston Martin": "astonmartin",
    "Williams": "williams",
    "Alpine": "alpine",
    "Haas F1 Team": "haasf1team",
    "Racing Bulls": "racingbulls",
    "Audi": "audi",
    "Cadillac": "cadillac",
  },
  2025: {
    "McLaren": "mclaren",
    "Red Bull Racing": "redbullracing",
    "Ferrari": "ferrari",
    "Mercedes": "mercedes",
    "Aston Martin": "astonmartin",
    "Williams": "williams",
    "Alpine": "alpine",
    "Haas F1 Team": "haasf1team",
    "Racing Bulls": "racingbulls",
    "Kick Sauber": "kicksauber",
  },
  2024: {
    "McLaren": "mclaren",
    "Red Bull Racing": "redbullracing",
    "Ferrari": "ferrari",
    "Mercedes": "mercedes",
    "Aston Martin": "astonmartin",
    "Williams": "williams",
    "Alpine": "alpine",
    "Haas F1 Team": "haas",   // CDN used "haas" not "haasf1team" in 2024
    "RB": "rb",               // OpenF1 calls them "RB" in 2024
    "Kick Sauber": "kicksauber",
  },
};

/** Returns a high-quality driver portrait URL for the given season year.
 *  Uses the official F1 CDN year-specific path for 2024+.
 *  Falls back to the Cloudinary-upscaled legacy path for 2023 and earlier.
 */
export function headshotHiRes(
  url: string | null | undefined,
  teamName?: string | null,
  year?: number | null
): string | null {
  if (!url) return null;

  const season = year ?? new Date().getFullYear();
  const slugMap = TEAM_CDN_SLUG_BY_YEAR[season];
  const teamSlug = teamName && slugMap ? slugMap[teamName] : null;
  const codeMatch = url.match(/\/([a-z0-9]+)\.png\.transform/);

  if (codeMatch && teamSlug) {
    const code = codeMatch[1];
    return `https://media.formula1.com/image/upload/f_auto,c_limit,q_auto,w_640/v1740000001/common/f1/${season}/${teamSlug}/${code}/${season}${teamSlug}${code}right.webp`;
  }

  // 2023 and earlier (or unknown team): use the legacy Cloudinary path
  const legacyMatch = url.match(
    /https:\/\/media\.formula1\.com\/d_driver_fallback_image\.png\/(content\/dam\/.+?)\.png\.transform\/.+$/
  );
  if (legacyMatch) {
    return `https://media.formula1.com/image/upload/f_auto,c_limit,q_auto,w_640/${legacyMatch[1]}.png`;
  }

  return url.replace(/\.transform\/\w+\/image\.png$/, ".transform/4col/image.png");
}

/** Get a flag image URL for an OpenF1 country_code. */
export function countryFlagUrl(countryCode: string): string {
  const alpha2 = (ALPHA3_TO_ALPHA2[countryCode] ?? countryCode.slice(0, 2)).toLowerCase();
  return `https://flagcdn.com/w40/${alpha2}.png`;
}
