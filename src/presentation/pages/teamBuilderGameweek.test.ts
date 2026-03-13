import { describe, expect, it } from "vitest";
import { resolveFixtureTargetGameweek } from "./teamBuilderGameweek";

describe("resolveFixtureTargetGameweek", () => {
  it("prefers the dashboard gameweek when available", () => {
    expect(resolveFixtureTargetGameweek(1, 21)).toBe(1);
  });

  it("falls back to the fixture-derived gameweek when dashboard gameweek is unavailable", () => {
    expect(resolveFixtureTargetGameweek(null, 21)).toBe(21);
  });

  it("returns null when neither source has a valid gameweek", () => {
    expect(resolveFixtureTargetGameweek(null, null)).toBeNull();
    expect(resolveFixtureTargetGameweek(0, -1)).toBeNull();
  });
});
