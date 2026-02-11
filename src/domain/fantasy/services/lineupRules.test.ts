import { describe, expect, it } from "vitest";
import { validateLineup } from "./lineupRules";
import type { TeamLineup } from "../entities/Team";
import type { Player } from "../entities/Player";

const players: Player[] = [
  { id: "gk1", leagueId: "idn-liga-1", name: "GK 1", club: "A", position: "GK", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d1", leagueId: "idn-liga-1", name: "D 1", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d2", leagueId: "idn-liga-1", name: "D 2", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d3", leagueId: "idn-liga-1", name: "D 3", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d4", leagueId: "idn-liga-1", name: "D 4", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m1", leagueId: "idn-liga-1", name: "M 1", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m2", leagueId: "idn-liga-1", name: "M 2", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m3", leagueId: "idn-liga-1", name: "M 3", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m4", leagueId: "idn-liga-1", name: "M 4", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "f1", leagueId: "idn-liga-1", name: "F 1", club: "A", position: "FWD", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "f2", leagueId: "idn-liga-1", name: "F 2", club: "A", position: "FWD", price: 5, form: 7, projectedPoints: 5, isInjured: false }
];

const validLineup: TeamLineup = {
  leagueId: "idn-liga-1",
  goalkeeperId: "gk1",
  defenderIds: ["d1", "d2", "d3", "d4"],
  midfielderIds: ["m1", "m2", "m3", "m4"],
  forwardIds: ["f1", "f2"],
  captainId: "f1",
  viceCaptainId: "m1",
  updatedAt: new Date().toISOString()
};

describe("validateLineup", () => {
  it("returns valid for complete 1-4-4-2 lineup", () => {
    const byId = new Map(players.map((player) => [player.id, player]));
    const result = validateLineup(validLineup, byId);

    expect(result.valid).toBe(true);
  });

  it("fails when captain and vice captain are the same", () => {
    const byId = new Map(players.map((player) => [player.id, player]));
    const result = validateLineup(
      {
        ...validLineup,
        viceCaptainId: validLineup.captainId
      },
      byId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("different");
  });

  it("fails when non-defender is placed in DEF slot", () => {
    const byId = new Map(players.map((player) => [player.id, player]));
    const result = validateLineup(
      {
        ...validLineup,
        defenderIds: ["d1", "d2", "d3", "m1"],
        midfielderIds: ["d4", "m2", "m3", "m4"]
      },
      byId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("DEF");
  });
});
