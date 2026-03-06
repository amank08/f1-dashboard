import type { TireCompound } from "@/lib/openf1/types";

export const TIRE_COLORS: Record<TireCompound, string> = {
  SOFT: "#FF3333",
  MEDIUM: "#FFC906",
  HARD: "#EEEEEE",
  INTERMEDIATE: "#43B02A",
  WET: "#0067FF",
};

export function getTeamColor(teamColour: string): string {
  return `#${teamColour}`;
}

export const POSITION_COLORS = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
} as Record<number, string>;
