export type TopScoreType =
    | "GOAL_TOPSCORER"
    | "ASSIST_TOPSCORER"
    | "REDCARDS"
    | "YELLOWCARDS";

export type TopScoreStatsApiResponse = {
    apiVersion: string;
    data: Record<TopScoreType, TopScoresDetail[]>;
};

export type TopScoresDetail = {
    typeId: number;
    typeName: string;
    rank: number;
    total: number;
    leagueID: string;
    playerID: number;
    season: string;
    participantID: number;
    playerName: string;
    imagePlayer?: string | null;
    nationality?: string | null;
    imageNationality?: string | null;
    participantName: string;
    imageParticipant?: string | null;
    positionName?: string | null;
};
