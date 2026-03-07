import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import {TopScoreType} from "@/domain/fantasy/entities/TopScore";

export class GetTopScore {
    constructor(private readonly fantasyRepository: FantasyRepository) {}

    async execute(leagueId: string, season: string, type :TopScoreType) {
        const normalizedLeagueId = leagueId.trim();
        const normalizedSeason = season.trim();
        if (!normalizedLeagueId) {
            throw new Error("League id is required.");
        }
        if (!normalizedSeason) {
            throw new Error("season  is required.");
        }

        return this.fantasyRepository.getTopScoreDetails(normalizedLeagueId, normalizedSeason, type);
    }
}
