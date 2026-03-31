import { describe, it, expect } from "vitest";
import {
  formatLapTime,
  formatGap,
  formatSpeed,
  formatPosition,
  formatDuration,
  countryFlagUrl,
} from "@/lib/utils/formatters";

describe("formatLapTime", () => {
  it("formats times over 60s with minutes", () => {
    expect(formatLapTime(90.123)).toBe("1:30.123");
  });

  it("formats times under 60s without minutes", () => {
    expect(formatLapTime(45.678)).toBe("45.678");
  });

  it("pads seconds to 6 chars when minutes present", () => {
    expect(formatLapTime(61.5)).toBe("1:01.500");
  });

  it("returns dash for null", () => {
    expect(formatLapTime(null)).toBe("—");
  });
});

describe("formatGap", () => {
  it("returns LEADER for zero gap", () => {
    expect(formatGap(0)).toBe("LEADER");
  });

  it("formats positive gap with plus sign", () => {
    expect(formatGap(1.234)).toBe("+1.234");
  });

  it("returns dash for null", () => {
    expect(formatGap(null)).toBe("—");
  });
});

describe("formatSpeed", () => {
  it("formats speed with km/h", () => {
    expect(formatSpeed(325.7)).toBe("326 km/h");
  });

  it("returns dash for null", () => {
    expect(formatSpeed(null)).toBe("—");
  });
});

describe("formatPosition", () => {
  it("returns ordinal suffixes correctly", () => {
    expect(formatPosition(1)).toBe("1st");
    expect(formatPosition(2)).toBe("2nd");
    expect(formatPosition(3)).toBe("3rd");
    expect(formatPosition(4)).toBe("4th");
    expect(formatPosition(20)).toBe("20th");
  });
});

describe("formatDuration", () => {
  it("formats with one decimal and s suffix", () => {
    expect(formatDuration(23.456)).toBe("23.5s");
  });

  it("returns dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("countryFlagUrl", () => {
  it("converts alpha-3 to alpha-2 flag URL", () => {
    expect(countryFlagUrl("GBR")).toBe("https://flagcdn.com/w40/gb.png");
  });

  it("handles direct alpha-2-ish codes", () => {
    expect(countryFlagUrl("US")).toBe("https://flagcdn.com/w40/us.png");
  });
});
