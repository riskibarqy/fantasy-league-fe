import { describe, expect, it } from "vitest";
import type { Player } from "../entities/Player";
import { mockPlayers } from "../../../infrastructure/mocks/data";
import { buildLineupFromPlayers, pickAutoSquadPlayerIds } from "./squadBuilder";

const idnPlayers = mockPlayers.filter((player) => player.leagueId === "idn-liga-1");

describe("squadBuilder", () => {
  it("builds lineup from preferred players", () => {
    const preferred = idnPlayers.slice(0, 11).map((player) => player.id);
    const lineup = buildLineupFromPlayers("idn-liga-1", idnPlayers, preferred);
    const playersByID = new Map(idnPlayers.map((player) => [player.id, player]));

    expect(lineup.goalkeeperId).toBeTruthy();
    expect(lineup.defenderIds.length).toBeGreaterThanOrEqual(3);
    expect(lineup.defenderIds.length).toBeLessThanOrEqual(5);
    expect(lineup.midfielderIds.length).toBeGreaterThanOrEqual(3);
    expect(lineup.midfielderIds.length).toBeLessThanOrEqual(5);
    expect(lineup.forwardIds.length).toBeGreaterThanOrEqual(1);
    expect(lineup.forwardIds.length).toBeLessThanOrEqual(3);
    expect(
      1 + lineup.defenderIds.length + lineup.midfielderIds.length + lineup.forwardIds.length
    ).toBe(11);
    expect(lineup.substituteIds.length).toBe(4);

    const benchCounts = lineup.substituteIds.reduce<Record<Player["position"], number>>(
      (count, playerID) => {
        const player = playersByID.get(playerID);
        if (player) {
          count[player.position] += 1;
        }
        return count;
      },
      { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    );

    expect(benchCounts.GK).toBe(1);
    expect(benchCounts.DEF).toBe(5 - lineup.defenderIds.length);
    expect(benchCounts.MID).toBe(5 - lineup.midfielderIds.length);
    expect(benchCounts.FWD).toBe(3 - lineup.forwardIds.length);
  });

  it("auto picks valid squad ids with exact 2/5/5/3 composition", () => {
    const pickedIds = pickAutoSquadPlayerIds(idnPlayers);
    const playersById = new Map(idnPlayers.map((player) => [player.id, player]));
    const pickedPlayers = pickedIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));

    expect(new Set(pickedIds).size).toBe(15);
    expect(pickedPlayers.length).toBe(15);

    const positionCounts = pickedPlayers.reduce<Record<Player["position"], number>>(
      (count, player) => {
        count[player.position] += 1;
        return count;
      },
      { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    );

    expect(positionCounts.GK).toBe(2);
    expect(positionCounts.DEF).toBe(5);
    expect(positionCounts.MID).toBe(5);
    expect(positionCounts.FWD).toBe(3);

    const byTeam = pickedPlayers.reduce<Record<string, number>>((count, player) => {
      count[player.club] = (count[player.club] ?? 0) + 1;
      return count;
    }, {});

    Object.values(byTeam).forEach((count) => expect(count).toBeLessThanOrEqual(3));
  });
});
