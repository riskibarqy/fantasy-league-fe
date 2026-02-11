export type Position = "GK" | "DEF" | "MID" | "FWD";

export type Player = {
  id: string;
  leagueId: string;
  name: string;
  club: string;
  position: Position;
  price: number;
  form: number;
  projectedPoints: number;
  isInjured: boolean;
};
