import type React from "react";
import type { TireCompound } from "@/lib/openf1/types";

export const TIRE_COLORS: Record<TireCompound, string> = {
  SOFT: "#FF3333",
  MEDIUM: "#FFC906",
  HARD: "#EEEEEE",
  INTERMEDIATE: "#43B02A",
  WET: "#0067FF",
};

// Override team colours that don't look right from the API
const TEAM_COLOR_OVERRIDES: Record<string, string> = {
  "Cadillac": "#FFFFFF",
  "Alpine": "#FF87BC",
  "Red Bull Racing": "#003478",
  "Audi": "#8B0000",
};

export function getTeamColor(teamColour: string, teamName?: string): string {
  if (teamName && TEAM_COLOR_OVERRIDES[teamName]) return TEAM_COLOR_OVERRIDES[teamName];
  return `#${teamColour}`;
}

export const POSITION_COLORS = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
} as Record<number, string>;

// Map OpenF1 team_name → slug used in the F1 media CDN
const TEAM_LOGO_SLUGS: Record<string, string> = {
  "Red Bull Racing": "redbullracing",
  "McLaren": "mclaren",
  "Ferrari": "ferrari",
  "Mercedes": "mercedes",
  "Aston Martin": "astonmartin",
  "Alpine": "alpine",
  "Williams": "williams",
  "Haas F1 Team": "haasf1team",
  "Kick Sauber": "kicksauber",
  "Racing Bulls": "racingbulls",
  // 2026 name changes
  "Audi": "audi",
  "Cadillac": "cadillac",
};

// Teams whose colour is light enough that a white logo is hard to see
const DARK_LOGO_TEAMS = new Set(["Mercedes", "McLaren", "Kick Sauber", "Cadillac"]);

// Teams that use the full-color logo variant instead of white/black
const COLOR_LOGO_TEAMS = new Set(["Alpine", "Red Bull Racing", "Ferrari"]);

// Teams that should always use the 2026 CDN logos (rebranded/new logos)
const USE_2026_LOGO = new Set(["Williams", "Audi", "Cadillac"]);

export function getTeamLogoUrl(teamName: string, year = 2025, size = 96): string | null {
  const slug = TEAM_LOGO_SLUGS[teamName];
  if (!slug) return null;
  // Use 2025 logos for 2024-2025, except teams that rebranded for 2026
  const cdnYear = USE_2026_LOGO.has(teamName) ? 2026 : Math.max(year, 2025);
  const variant = COLOR_LOGO_TEAMS.has(teamName) ? "logo" : DARK_LOGO_TEAMS.has(teamName) ? "logoblack" : "logowhite";
  return `https://media.formula1.com/image/upload/e_trim/c_lfill,w_${size}/q_auto/v1740000000/common/f1/${cdnYear}/${slug}/${cdnYear}${slug}${variant}.webp`;
}

// Per-team CSS style tweaks for logo positioning inside the circle
const LOGO_STYLE_OVERRIDES: Record<string, React.CSSProperties> = {
  "Williams": { marginLeft: "2px" },
};

export function getTeamLogoStyle(teamName: string): React.CSSProperties | undefined {
  return LOGO_STYLE_OVERRIDES[teamName];
}
