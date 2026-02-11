import { describe, expect, it } from "vitest";
import { validateLineup } from "./lineupRules";
import type { TeamLineup } from "../entities/Team";
import type { Player } from "../entities/Player";

const players: Player[] = [
  { id: "gk1", leagueId: "idn-liga-1", name: "GK 1", club: "A", position: "GK", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "gk2", leagueId: "idn-liga-1", name: "GK 2", club: "A", position: "GK", price: 4.5, form: 6, projectedPoints: 4, isInjured: false },
  { id: "d1", leagueId: "idn-liga-1", name: "D 1", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d2", leagueId: "idn-liga-1", name: "D 2", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d3", leagueId: "idn-liga-1", name: "D 3", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d4", leagueId: "idn-liga-1", name: "D 4", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "d5", leagueId: "idn-liga-1", name: "D 5", club: "A", position: "DEF", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m1", leagueId: "idn-liga-1", name: "M 1", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m2", leagueId: "idn-liga-1", name: "M 2", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m3", leagueId: "idn-liga-1", name: "M 3", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m4", leagueId: "idn-liga-1", name: "M 4", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "m5", leagueId: "idn-liga-1", name: "M 5", club: "A", position: "MID", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "f1", leagueId: "idn-liga-1", name: "F 1", club: "A", position: "FWD", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "f2", leagueId: "idn-liga-1", name: "F 2", club: "A", position: "FWD", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "f3", leagueId: "idn-liga-1", name: "F 3", club: "A", position: "FWD", price: 5, form: 7, projectedPoints: 5, isInjured: false },
  { id: "f4", leagueId: "idn-liga-1", name: "F 4", club: "A", position: "FWD", price: 5, form: 7, projectedPoints: 5, isInjured: false }
];

const validLineup: TeamLineup = {
  leagueId: "idn-liga-1",
  goalkeeperId: "gk1",
  defenderIds: ["d1", "d2", "d3", "d4"],
  midfielderIds: ["m1", "m2", "m3", "m4"],
  forwardIds: ["f1", "f2"],
  substituteIds: ["gk2", "d5", "m5", "f3", "f4"],
  captainId: "f1",
  viceCaptainId: "m1",
  updatedAt: new Date().toISOString()
};

describe("validateLineup", () => {
  it("returns valid for complete squad with five substitutes", () => {
    const byId = new Map(players.map((player) => [player.id, player]));
    const result = validateLineup(validLineup, byId);

    expect(result.valid).toBe(true);
  });

  it("fails when defenders are below minimum", () => {
    const byId = new Map(players.map((player) => [player.id, player]));
    const result = validateLineup(
      {
        ...validLineup,
        defenderIds: ["d1"],
        midfielderIds: ["m1", "m2", "m3", "m4", "m5"],
        forwardIds: ["f1", "f2", "f3", "f4"],
        substituteIds: ["gk2", "d2", "d3", "d4", "d5"]
      },
      byId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Defender count");
  });

  it("fails when substitutes overlap with starters", () => {
    const byId = new Map(players.map((player) => [player.id, player]));
    const result = validateLineup(
      {
        ...validLineup,
        substituteIds: ["d1", "gk2", "d5", "m5", "f3"]
      },
      byId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Substitutes");
  });
});
