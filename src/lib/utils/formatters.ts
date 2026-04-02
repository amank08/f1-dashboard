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

/** Upgrade an OpenF1 headshot URL to a high-quality Cloudinary render.
 *  Converts the fallback-prefixed transform URL to the proper Cloudinary
 *  image/upload path with auto format (WebP/AVIF), auto quality, and 640px width.
 */
export function headshotHiRes(url: string | null | undefined): string | null {
  if (!url) return null;
  // Strip the fallback prefix and the trailing .transform/Xcol/image.png
  const match = url.match(
    /https:\/\/media\.formula1\.com\/d_driver_fallback_image\.png\/(content\/dam\/.+?)\.png\.transform\/.+$/
  );
  if (match) {
    return `https://media.formula1.com/image/upload/f_auto,c_limit,q_auto,w_640/${match[1]}.png`;
  }
  // Fallback: just bump to 4col for any other URL pattern
  return url.replace(/\.transform\/\w+\/image\.png$/, ".transform/4col/image.png");
}

/** Get a flag image URL for an OpenF1 country_code. */
export function countryFlagUrl(countryCode: string): string {
  const alpha2 = (ALPHA3_TO_ALPHA2[countryCode] ?? countryCode.slice(0, 2)).toLowerCase();
  return `https://flagcdn.com/w40/${alpha2}.png`;
}
