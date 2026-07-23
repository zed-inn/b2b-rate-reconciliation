import { describe, it, expect } from "vitest";
import { calculateDelay } from "../scheduler";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

describe("calculateDelay", () => {
  it("returns 10000ms in demo mode", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(calculateDelay(futureDate, true)).toBe(10000);
  });

  it("returns 0 when check-in is less than 48 hours away", () => {
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(calculateDelay(in24Hours, false)).toBe(0);
  });

  it("returns 0 when check-in is in the past", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(calculateDelay(yesterday, false)).toBe(0);
  });

  it("returns positive delay when check-in is more than 48 hours away", () => {
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const delay = calculateDelay(in7Days, false);

    // Should be approximately 5 days in ms (7 days - 48 hours)
    const expectedApprox = 5 * 24 * 60 * 60 * 1000;
    expect(delay).toBeGreaterThan(expectedApprox - 5000);
    expect(delay).toBeLessThan(expectedApprox + 5000);
  });

  it("returns close to 0 when check-in is exactly 48 hours away", () => {
    const in48Hours = new Date(Date.now() + FORTY_EIGHT_HOURS_MS);
    const delay = calculateDelay(in48Hours, false);
    // Within test execution tolerance
    expect(delay).toBeLessThanOrEqual(100);
  });
});
