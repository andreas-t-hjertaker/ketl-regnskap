import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatRelativeTime,
  truncate,
  sleep,
  generateId,
  cn,
} from "@/lib/utils";

describe("cn", () => {
  it("slår sammen klasser", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("håndterer betingede klasser", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("merger tailwind-konflikter", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});

describe("formatDate", () => {
  it("formaterer dato på norsk som standard", () => {
    const result = formatDate(new Date("2026-03-17"));
    expect(result).toContain("mars");
    expect(result).toContain("2026");
  });

  it("støtter egendefinert locale", () => {
    const result = formatDate(new Date("2026-03-17"), "en-US");
    expect(result).toContain("March");
  });

  it("håndterer streng-input", () => {
    const result = formatDate("2026-01-01");
    expect(result).toContain("2026");
  });
});

describe("formatRelativeTime", () => {
  it("returnerer 'akkurat nå' for nylige tidspunkt", () => {
    expect(formatRelativeTime(new Date())).toBe("akkurat nå");
  });

  it("viser minutter", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 minutter siden");
  });

  it("viser entall minutt", () => {
    const oneMinAgo = new Date(Date.now() - 90 * 1000);
    expect(formatRelativeTime(oneMinAgo)).toBe("1 minutt siden");
  });

  it("viser timer", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 timer siden");
  });

  it("viser dager", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 dager siden");
  });
});

describe("truncate", () => {
  it("returnerer original streng om den er kort nok", () => {
    expect(truncate("hei", 10)).toBe("hei");
  });

  it("avkorter med ellipsis", () => {
    expect(truncate("dette er en lang tekst", 10)).toBe("dette er e…");
  });

  it("håndterer eksakt lengde", () => {
    expect(truncate("abc", 3)).toBe("abc");
  });
});

describe("sleep", () => {
  it("venter angitt tid", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe("generateId", () => {
  it("genererer unike IDer", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("returnerer en streng", () => {
    expect(typeof generateId()).toBe("string");
  });
});
