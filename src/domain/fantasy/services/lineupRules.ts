import type { Player } from "../entities/Player";
import type { TeamLineup } from "../entities/Team";

const REQUIRED_COUNTS = {
  GK: 1,
  DEF: 4,
  MID: 4,
  FWD: 2
} as const;

export const TEAM_SIZE =
  REQUIRED_COUNTS.GK + REQUIRED_COUNTS.DEF + REQUIRED_COUNTS.MID + REQUIRED_COUNTS.FWD;

export const validateLineup = (
  lineup: TeamLineup,
  playersById: Map<string, Player>
): { valid: boolean; reason?: string } => {
  const selectedIds = [
    lineup.goalkeeperId,
    ...lineup.defenderIds,
    ...lineup.midfielderIds,
    ...lineup.forwardIds
  ];

  const uniqueIds = new Set(selectedIds);
  if (selectedIds.length !== TEAM_SIZE || uniqueIds.size !== TEAM_SIZE) {
    return { valid: false, reason: "Lineup must have 11 unique players." };
  }

  if (lineup.defenderIds.length !== REQUIRED_COUNTS.DEF) {
    return { valid: false, reason: "Lineup must include exactly 4 defenders." };
  }

  if (lineup.midfielderIds.length !== REQUIRED_COUNTS.MID) {
    return { valid: false, reason: "Lineup must include exactly 4 midfielders." };
  }

  if (lineup.forwardIds.length !== REQUIRED_COUNTS.FWD) {
    return { valid: false, reason: "Lineup must include exactly 2 forwards." };
  }

  if (!uniqueIds.has(lineup.captainId) || !uniqueIds.has(lineup.viceCaptainId)) {
    return { valid: false, reason: "Captain and vice captain must be in lineup." };
  }

  if (lineup.captainId === lineup.viceCaptainId) {
    return { valid: false, reason: "Captain and vice captain must be different." };
  }

  for (const playerId of selectedIds) {
    const player = playersById.get(playerId);

    if (!player) {
      return { valid: false, reason: `Unknown player: ${playerId}` };
    }
  }

  const gk = playersById.get(lineup.goalkeeperId);
  if (!gk || gk.position !== "GK") {
    return { valid: false, reason: "Goalkeeper slot must contain a GK." };
  }

  const validatePosition = (ids: string[], position: Player["position"]): boolean => {
    return ids.every((id) => playersById.get(id)?.position === position);
  };

  if (!validatePosition(lineup.defenderIds, "DEF")) {
    return { valid: false, reason: "All defender slots must contain DEF players." };
  }

  if (!validatePosition(lineup.midfielderIds, "MID")) {
    return { valid: false, reason: "All midfielder slots must contain MID players." };
  }

  if (!validatePosition(lineup.forwardIds, "FWD")) {
    return { valid: false, reason: "All forward slots must contain FWD players." };
  }

  return { valid: true };
};
