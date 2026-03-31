import { describe, it, expect } from "vitest";
import { getTeamColor, getTeamLogoUrl, TIRE_COLORS } from "@/lib/utils/colors";

describe("getTeamColor", () => {
  it("returns override color when team name matches", () => {
    expect(getTeamColor("0000FF", "Alpine")).toBe("#FF87BC");
  });

  it("returns hex from API colour when no override", () => {
    expect(getTeamColor("FF8700", "McLaren")).toBe("#FF8700");
  });
});

describe("getTeamLogoUrl", () => {
  it("returns null for unknown team", () => {
    expect(getTeamLogoUrl("Unknown Team")).toBeNull();
  });

  it("returns a valid URL for known teams", () => {
    const url = getTeamLogoUrl("Ferrari");
    expect(url).toContain("ferrari");
    expect(url).toContain("logo");
  });

  it("uses 2026 CDN year for rebranded teams", () => {
    const url = getTeamLogoUrl("Audi", 2025);
    expect(url).toContain("/2026/");
  });
});

describe("TIRE_COLORS", () => {
  it("has entries for all five compounds", () => {
    expect(Object.keys(TIRE_COLORS)).toHaveLength(5);
    expect(TIRE_COLORS.SOFT).toBeDefined();
    expect(TIRE_COLORS.WET).toBeDefined();
  });
});
