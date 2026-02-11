import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import type { Player } from "../../../domain/fantasy/entities/Player";
import type { TeamLineup } from "../../../domain/fantasy/entities/Team";
import { validateLineup } from "../../../domain/fantasy/services/lineupRules";

export class SaveLineup {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(lineup: TeamLineup, players: Player[]) {
    const playersById = new Map(players.map((player) => [player.id, player]));
    const validation = validateLineup(lineup, playersById);

    if (!validation.valid) {
      throw new Error(validation.reason ?? "Lineup is invalid.");
    }

    return this.fantasyRepository.saveLineup({
      ...lineup,
      updatedAt: new Date().toISOString()
    });
  }
}
