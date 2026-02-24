import type { Player } from "../entities/Player";
import type { TeamLineup } from "../entities/Team";
import { FORMATION_LIMITS, SQUAD_POSITION_LIMITS } from "./lineupRules";

const AUTO_SQUAD_SIZE = 15;
const BENCH_SIZE = 4;
const MAX_PLAYERS_PER_TEAM = 3;
const BUDGET_CAP = 150;

type Formation = {
  DEF: number;
  MID: number;
  FWD: number;
};

const STARTER_FORMATIONS: Formation[] = [];
for (let defender = FORMATION_LIMITS.DEF.min; defender <= FORMATION_LIMITS.DEF.max; defender += 1) {
  for (let midfielder = FORMATION_LIMITS.MID.min; midfielder <= FORMATION_LIMITS.MID.max; midfielder += 1) {
    for (let forward = FORMATION_LIMITS.FWD.min; forward <= FORMATION_LIMITS.FWD.max; forward += 1) {
      if (defender + midfielder + forward === 10) {
        STARTER_FORMATIONS.push({ DEF: defender, MID: midfielder, FWD: forward });
      }
    }
  }
}

const byProjectedThenPrice = (left: Player, right: Player): number => {
  if (left.projectedPoints !== right.projectedPoints) {
    return right.projectedPoints - left.projectedPoints;
  }

  if (left.form !== right.form) {
    return right.form - left.form;
  }

  if (left.price !== right.price) {
    return left.price - right.price;
  }

  return left.id.localeCompare(right.id);
};

const byValueThenProjected = (left: Player, right: Player): number => {
  const leftValue = left.projectedPoints / Math.max(left.price, 0.1);
  const rightValue = right.projectedPoints / Math.max(right.price, 0.1);
  if (leftValue !== rightValue) {
    return rightValue - leftValue;
  }

  return byProjectedThenPrice(left, right);
};

const byPriceThenProjected = (left: Player, right: Player): number => {
  if (left.price !== right.price) {
    return left.price - right.price;
  }

  return byProjectedThenPrice(left, right);
};

const sortWithPreference = (
  players: Player[],
  preferredIds: string[],
  fallbackSort: (left: Player, right: Player) => number
): Player[] => {
  const order = new Map<string, number>();
  preferredIds.forEach((id, index) => {
    order.set(id, index);
  });

  return [...players].sort((left, right) => {
    const leftOrder = order.get(left.id);
    const rightOrder = order.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) {
      return -1;
    }

    if (rightOrder !== undefined) {
      return 1;
    }

    return fallbackSort(left, right);
  });
};

const pickFirstAvailable = (
  pool: Player[],
  count: number,
  used: Set<string>
): Player[] | null => {
  if (count === 0) {
    return [];
  }

  const picked: Player[] = [];

  for (const player of pool) {
    if (used.has(player.id)) {
      continue;
    }

    picked.push(player);
    if (picked.length === count) {
      return picked;
    }
  }

  return null;
};

const canPick = (
  player: Player,
  selectedById: Set<string>,
  selectedByTeam: Map<string, number>,
  totalBudget: number,
  enforceBudget: boolean
): boolean => {
  if (selectedById.has(player.id)) {
    return false;
  }

  if ((selectedByTeam.get(player.club) ?? 0) >= MAX_PLAYERS_PER_TEAM) {
    return false;
  }

  if (enforceBudget && totalBudget + player.price > BUDGET_CAP) {
    return false;
  }

  return true;
};

export const buildLineupFromPlayers = (
  leagueId: string,
  players: Player[],
  preferredStarterIds: string[] = []
): TeamLineup => {
  const byPosition: Record<Player["position"], Player[]> = {
    GK: sortWithPreference(
      players.filter((player) => player.position === "GK"),
      preferredStarterIds,
      byProjectedThenPrice
    ),
    DEF: sortWithPreference(
      players.filter((player) => player.position === "DEF"),
      preferredStarterIds,
      byProjectedThenPrice
    ),
    MID: sortWithPreference(
      players.filter((player) => player.position === "MID"),
      preferredStarterIds,
      byProjectedThenPrice
    ),
    FWD: sortWithPreference(
      players.filter((player) => player.position === "FWD"),
      preferredStarterIds,
      byProjectedThenPrice
    )
  };

  const starterGoalkeeper = byPosition.GK[0];
  if (!starterGoalkeeper) {
    throw new Error("Cannot build lineup without at least one goalkeeper.");
  }

  let best:
    | {
        goalkeeper: Player;
        defenders: Player[];
        midfielders: Player[];
        forwards: Player[];
        substitutes: Player[];
        score: number;
      }
    | null = null;

  for (const formation of STARTER_FORMATIONS) {
    const used = new Set<string>([starterGoalkeeper.id]);

    const defenderStarters = pickFirstAvailable(byPosition.DEF, formation.DEF, used);
    const midfielderStarters = pickFirstAvailable(byPosition.MID, formation.MID, used);
    const forwardStarters = pickFirstAvailable(byPosition.FWD, formation.FWD, used);
    if (!defenderStarters || !midfielderStarters || !forwardStarters) {
      continue;
    }

    defenderStarters.forEach((player) => used.add(player.id));
    midfielderStarters.forEach((player) => used.add(player.id));
    forwardStarters.forEach((player) => used.add(player.id));

    const benchRequirements = {
      GK: 1,
      DEF: SQUAD_POSITION_LIMITS.DEF - formation.DEF,
      MID: SQUAD_POSITION_LIMITS.MID - formation.MID,
      FWD: SQUAD_POSITION_LIMITS.FWD - formation.FWD
    };

    if (
      benchRequirements.DEF < 0 ||
      benchRequirements.MID < 0 ||
      benchRequirements.FWD < 0 ||
      benchRequirements.GK + benchRequirements.DEF + benchRequirements.MID + benchRequirements.FWD !== BENCH_SIZE
    ) {
      continue;
    }

    const benchGoalkeepers = pickFirstAvailable(byPosition.GK, benchRequirements.GK, used);
    const benchDefenders = pickFirstAvailable(byPosition.DEF, benchRequirements.DEF, used);
    const benchMidfielders = pickFirstAvailable(byPosition.MID, benchRequirements.MID, used);
    const benchForwards = pickFirstAvailable(byPosition.FWD, benchRequirements.FWD, used);

    if (!benchGoalkeepers || !benchDefenders || !benchMidfielders || !benchForwards) {
      continue;
    }

    const substitutes = [
      ...benchGoalkeepers,
      ...benchDefenders,
      ...benchMidfielders,
      ...benchForwards
    ];

    const starters = [starterGoalkeeper, ...defenderStarters, ...midfielderStarters, ...forwardStarters];
    const score = starters.reduce((sum, player) => sum + player.projectedPoints, 0);

    if (!best || score > best.score) {
      best = {
        goalkeeper: starterGoalkeeper,
        defenders: defenderStarters,
        midfielders: midfielderStarters,
        forwards: forwardStarters,
        substitutes,
        score
      };
    }
  }

  if (!best) {
    throw new Error("Cannot build a valid lineup from available players.");
  }

  const allPlayers = [
    best.goalkeeper,
    ...best.defenders,
    ...best.midfielders,
    ...best.forwards,
    ...best.substitutes
  ];

  if (allPlayers.length !== AUTO_SQUAD_SIZE || new Set(allPlayers.map((player) => player.id)).size !== AUTO_SQUAD_SIZE) {
    throw new Error("Cannot build lineup with exactly 15 unique players.");
  }

  const captainCandidates = [best.goalkeeper, ...best.defenders, ...best.midfielders, ...best.forwards].sort(
    byProjectedThenPrice
  );
  const captainId = captainCandidates[0]?.id ?? "";
  const viceCaptainId = captainCandidates[1]?.id ?? "";

  return {
    leagueId,
    goalkeeperId: best.goalkeeper.id,
    defenderIds: best.defenders.map((player) => player.id),
    midfielderIds: best.midfielders.map((player) => player.id),
    forwardIds: best.forwards.map((player) => player.id),
    substituteIds: best.substitutes.map((player) => player.id),
    captainId,
    viceCaptainId,
    updatedAt: new Date().toISOString()
  };
};

const tryBuildAutoSquad = (
  players: Player[],
  comparator: (left: Player, right: Player) => number,
  enforceBudget: boolean
): string[] | null => {
  const selected: Player[] = [];
  const selectedById = new Set<string>();
  const selectedByTeam = new Map<string, number>();
  let totalBudget = 0;

  const sortedByPosition: Record<Player["position"], Player[]> = {
    GK: [...players.filter((player) => player.position === "GK")].sort(comparator),
    DEF: [...players.filter((player) => player.position === "DEF")].sort(comparator),
    MID: [...players.filter((player) => player.position === "MID")].sort(comparator),
    FWD: [...players.filter((player) => player.position === "FWD")].sort(comparator)
  };

  const addPlayer = (player: Player): void => {
    selected.push(player);
    selectedById.add(player.id);
    selectedByTeam.set(player.club, (selectedByTeam.get(player.club) ?? 0) + 1);
    totalBudget += player.price;
  };
  const removeLastPlayer = (player: Player): void => {
    selected.pop();
    selectedById.delete(player.id);

    const currentTeamCount = selectedByTeam.get(player.club) ?? 0;
    if (currentTeamCount <= 1) {
      selectedByTeam.delete(player.club);
    } else {
      selectedByTeam.set(player.club, currentTeamCount - 1);
    }

    totalBudget -= player.price;
  };

  const positions: Player["position"][] = ["GK", "DEF", "MID", "FWD"];
  const requiredByPosition: Record<Player["position"], number> = {
    GK: SQUAD_POSITION_LIMITS.GK,
    DEF: SQUAD_POSITION_LIMITS.DEF,
    MID: SQUAD_POSITION_LIMITS.MID,
    FWD: SQUAD_POSITION_LIMITS.FWD
  };

  const pickAllPositions = (positionIndex: number): boolean => {
    if (positionIndex >= positions.length) {
      return true;
    }

    const position = positions[positionIndex];
    const required = requiredByPosition[position];
    const pool = sortedByPosition[position];

    const pickCombination = (startIndex: number, remaining: number): boolean => {
      if (remaining === 0) {
        return pickAllPositions(positionIndex + 1);
      }

      for (let index = startIndex; index < pool.length; index += 1) {
        if (pool.length-index < remaining) {
          return false;
        }

        const candidate = pool[index];
        if (!canPick(candidate, selectedById, selectedByTeam, totalBudget, enforceBudget)) {
          continue;
        }

        addPlayer(candidate);
        if (pickCombination(index+1, remaining-1)) {
          return true;
        }
        removeLastPlayer(candidate);
      }

      return false;
    };

    return pickCombination(0, required);
  };

  if (!pickAllPositions(0)) {
    return null;
  }

  if (selected.length !== AUTO_SQUAD_SIZE) {
    return null;
  }

  const positionCount = selected.reduce<Record<Player["position"], number>>(
    (count, player) => {
      count[player.position] += 1;
      return count;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  );

  if (
    positionCount.GK !== SQUAD_POSITION_LIMITS.GK ||
    positionCount.DEF !== SQUAD_POSITION_LIMITS.DEF ||
    positionCount.MID !== SQUAD_POSITION_LIMITS.MID ||
    positionCount.FWD !== SQUAD_POSITION_LIMITS.FWD
  ) {
    return null;
  }

  if (enforceBudget && totalBudget > BUDGET_CAP) {
    return null;
  }

  return selected.map((player) => player.id);
};

export const pickAutoSquadPlayerIds = (players: Player[]): string[] => {
  const attempts = [
    { comparator: byProjectedThenPrice, enforceBudget: true },
    { comparator: byValueThenProjected, enforceBudget: true },
    { comparator: byPriceThenProjected, enforceBudget: true }
  ];

  for (const attempt of attempts) {
    const selected = tryBuildAutoSquad(players, attempt.comparator, attempt.enforceBudget);
    if (selected) {
      return selected;
    }
  }

  throw new Error("Unable to auto-pick a valid squad from available players.");
};
