import type { Dashboard, TeamLineup } from "../entities/Team";
import type { Fixture } from "../entities/Fixture";
import type { League } from "../entities/League";
import type { Player } from "../entities/Player";
import type { PickSquadInput, Squad } from "../entities/Squad";
import type { CustomLeague, CustomLeagueStanding } from "../entities/CustomLeague";

export interface FantasyRepository {
  getDashboard(): Promise<Dashboard>;
  getLeagues(): Promise<League[]>;
  getFixtures(leagueId: string): Promise<Fixture[]>;
  getPlayers(leagueId: string): Promise<Player[]>;
  getLineup(leagueId: string): Promise<TeamLineup | null>;
  saveLineup(lineup: TeamLineup): Promise<TeamLineup>;
  getMySquad(leagueId: string, accessToken: string): Promise<Squad | null>;
  pickSquad(input: PickSquadInput, accessToken: string): Promise<Squad>;
  getMyCustomLeagues(accessToken: string): Promise<CustomLeague[]>;
  getCustomLeague(groupId: string, accessToken: string): Promise<CustomLeague>;
  getCustomLeagueStandings(groupId: string, accessToken: string): Promise<CustomLeagueStanding[]>;
}
