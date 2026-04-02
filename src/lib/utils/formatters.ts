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

// Maps OpenF1 team_name → F1 CDN team slug used in 2026 portrait paths
const TEAM_CDN_SLUG: Record<string, string> = {
  "McLaren": "mclaren",
  "Red Bull Racing": "redbullracing",
  "Ferrari": "ferrari",
  "Mercedes": "mercedes",
  "Aston Martin": "astonmartin",
  "Williams": "williams",
  "Alpine": "alpine",
  "Haas F1 Team": "haasf1team",
  "Audi": "audi",
  "Racing Bulls": "racingbulls",
  "Cadillac": "cadillac",
};

/** Returns a high-quality 2026 season driver portrait URL.
 *  When teamName is provided, uses the official 2026 CDN path.
 *  Falls back to the Cloudinary-upscaled legacy path if team is unknown.
 */
export function headshotHiRes(
  url: string | null | undefined,
  teamName?: string | null
): string | null {
  if (!url) return null;

  // Extract driverCode from the OpenF1 URL (e.g. "lannor01")
  const codeMatch = url.match(/\/([a-z0-9]+)\.png\.transform/);
  const teamSlug = teamName ? TEAM_CDN_SLUG[teamName] : null;

  if (codeMatch && teamSlug) {
    const code = codeMatch[1];
    return `https://media.formula1.com/image/upload/f_auto,c_limit,q_auto,w_640/v1740000001/common/f1/2026/${teamSlug}/${code}/2026${teamSlug}${code}right.webp`;
  }

  // Fallback: strip the d_driver_fallback prefix and use Cloudinary at w_640
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
