import type { Dashboard, TeamLineup } from "../entities/Team";
import type { Fixture } from "../entities/Fixture";
import type { League } from "../entities/League";
import type { Player } from "../entities/Player";

export interface FantasyRepository {
  getDashboard(): Promise<Dashboard>;
  getLeagues(): Promise<League[]>;
  getFixtures(leagueId: string): Promise<Fixture[]>;
  getPlayers(leagueId: string): Promise<Player[]>;
  getLineup(leagueId: string): Promise<TeamLineup | null>;
  saveLineup(lineup: TeamLineup): Promise<TeamLineup>;
}
