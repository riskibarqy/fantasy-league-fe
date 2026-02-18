import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { Club } from "../../domain/fantasy/entities/Club";

export const mockLeagues: League[] = [
  {
    id: "idn-liga-1",
    name: "BRI Liga 1",
    countryCode: "ID",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Liga_1_Indonesia.png/320px-Liga_1_Indonesia.png"
  },
  {
    id: "eng-premier-league",
    name: "Premier League",
    countryCode: "GB",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/320px-Premier_League_Logo.svg.png"
  }
];

export const mockDashboard: Dashboard = {
  gameweek: 12,
  budget: 100,
  teamValue: 98.7,
  totalPoints: 645,
  rank: 2904,
  selectedLeagueId: "idn-liga-1"
};

export const mockTeams: Club[] = [
  {
    id: "idn-persib",
    leagueId: "idn-liga-1",
    name: "Persib Bandung",
    short: "PSB",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/0/07/Persib_Bandung_logo.svg"
  },
  {
    id: "idn-persija",
    leagueId: "idn-liga-1",
    name: "Persija Jakarta",
    short: "PSJ",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/4/4c/Persija_Jakarta_logo.svg"
  },
  {
    id: "idn-persebaya",
    leagueId: "idn-liga-1",
    name: "Persebaya Surabaya",
    short: "BAYA",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/0/05/Persebaya_logo.svg"
  },
  {
    id: "idn-borneo",
    leagueId: "idn-liga-1",
    name: "Borneo FC",
    short: "BOR",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/25/Borneo_FC_logo.png"
  },
  {
    id: "eng-arsenal",
    leagueId: "eng-premier-league",
    name: "Arsenal",
    short: "ARS",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg"
  },
  {
    id: "eng-liverpool",
    leagueId: "eng-premier-league",
    name: "Liverpool",
    short: "LIV",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg"
  }
];

export const mockFixtures: Fixture[] = [
  {
    id: "fx-1",
    leagueId: "idn-liga-1",
    gameweek: 12,
    homeTeam: "Persib Bandung",
    awayTeam: "Persebaya Surabaya",
    homeTeamLogoUrl: "https://upload.wikimedia.org/wikipedia/en/0/07/Persib_Bandung_logo.svg",
    awayTeamLogoUrl: "https://upload.wikimedia.org/wikipedia/en/0/05/Persebaya_logo.svg",
    kickoffAt: "2026-02-14T12:30:00.000Z",
    venue: "Stadion Gelora Bandung Lautan Api"
  },
  {
    id: "fx-2",
    leagueId: "idn-liga-1",
    gameweek: 12,
    homeTeam: "Persija Jakarta",
    awayTeam: "PSS Sleman",
    homeTeamLogoUrl: "https://upload.wikimedia.org/wikipedia/en/4/4c/Persija_Jakarta_logo.svg",
    awayTeamLogoUrl: "https://upload.wikimedia.org/wikipedia/en/8/8b/PSS_Sleman_logo.png",
    kickoffAt: "2026-02-15T08:00:00.000Z",
    venue: "Jakarta International Stadium"
  },
  {
    id: "fx-3",
    leagueId: "eng-premier-league",
    gameweek: 26,
    homeTeam: "Liverpool",
    awayTeam: "Arsenal",
    homeTeamLogoUrl: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
    awayTeamLogoUrl: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
    kickoffAt: "2026-02-15T16:30:00.000Z",
    venue: "Anfield"
  }
];

export const mockPlayers: Player[] = [
  {
    id: "idn-gk-1",
    leagueId: "idn-liga-1",
    name: "Andhika Ramadhani",
    club: "Persib Bandung",
    position: "GK",
    price: 5.5,
    form: 7.1,
    projectedPoints: 5.2,
    isInjured: false
  },
  {
    id: "idn-gk-2",
    leagueId: "idn-liga-1",
    name: "Nadeo Argawinata",
    club: "Borneo FC",
    position: "GK",
    price: 5,
    form: 6.8,
    projectedPoints: 4.9,
    isInjured: false
  },
  {
    id: "idn-def-1",
    leagueId: "idn-liga-1",
    name: "Rizky Ridho",
    club: "Persija Jakarta",
    position: "DEF",
    price: 6.7,
    form: 7.6,
    projectedPoints: 5.8,
    isInjured: false
  },
  {
    id: "idn-def-2",
    leagueId: "idn-liga-1",
    name: "Nick Kuipers",
    club: "Persib Bandung",
    position: "DEF",
    price: 6.3,
    form: 6.9,
    projectedPoints: 5.1,
    isInjured: false
  },
  {
    id: "idn-def-3",
    leagueId: "idn-liga-1",
    name: "Jordi Amat",
    club: "Johor DT XI",
    position: "DEF",
    price: 6,
    form: 6.5,
    projectedPoints: 4.8,
    isInjured: false
  },
  {
    id: "idn-def-4",
    leagueId: "idn-liga-1",
    name: "Bagas Kaffa",
    club: "Barito Putera",
    position: "DEF",
    price: 5.1,
    form: 5.9,
    projectedPoints: 4.4,
    isInjured: false
  },
  {
    id: "idn-def-5",
    leagueId: "idn-liga-1",
    name: "Yance Sayuri",
    club: "Malut United",
    position: "DEF",
    price: 5.6,
    form: 6.4,
    projectedPoints: 4.9,
    isInjured: false
  },
  {
    id: "idn-def-6",
    leagueId: "idn-liga-1",
    name: "Rezaldi Hehanussa",
    club: "Persib Bandung",
    position: "DEF",
    price: 5.4,
    form: 6.2,
    projectedPoints: 4.7,
    isInjured: false
  },
  {
    id: "idn-mid-1",
    leagueId: "idn-liga-1",
    name: "Marc Klok",
    club: "Persib Bandung",
    position: "MID",
    price: 8.2,
    form: 8.1,
    projectedPoints: 6.4,
    isInjured: false
  },
  {
    id: "idn-mid-2",
    leagueId: "idn-liga-1",
    name: "Taisei Marukawa",
    club: "PSIS Semarang",
    position: "MID",
    price: 8.7,
    form: 7.7,
    projectedPoints: 6.1,
    isInjured: false
  },
  {
    id: "idn-mid-3",
    leagueId: "idn-liga-1",
    name: "Eber Bessa",
    club: "Bali United",
    position: "MID",
    price: 7.9,
    form: 7.2,
    projectedPoints: 5.7,
    isInjured: false
  },
  {
    id: "idn-mid-4",
    leagueId: "idn-liga-1",
    name: "Akbar Arjunsyah",
    club: "Dewa United",
    position: "MID",
    price: 6.8,
    form: 6.7,
    projectedPoints: 5.2,
    isInjured: false
  },
  {
    id: "idn-mid-5",
    leagueId: "idn-liga-1",
    name: "Ricky Kambuaya",
    club: "Dewa United",
    position: "MID",
    price: 7.1,
    form: 6.9,
    projectedPoints: 5.3,
    isInjured: false
  },
  {
    id: "idn-mid-6",
    leagueId: "idn-liga-1",
    name: "Egy Maulana",
    club: "Dewa United",
    position: "MID",
    price: 7.3,
    form: 7,
    projectedPoints: 5.5,
    isInjured: false
  },
  {
    id: "idn-fwd-1",
    leagueId: "idn-liga-1",
    name: "David da Silva",
    club: "Persib Bandung",
    position: "FWD",
    price: 9.5,
    form: 8.5,
    projectedPoints: 7.2,
    isInjured: false
  },
  {
    id: "idn-fwd-2",
    leagueId: "idn-liga-1",
    name: "Matheus Pato",
    club: "Borneo FC",
    position: "FWD",
    price: 8.9,
    form: 8.2,
    projectedPoints: 6.9,
    isInjured: false
  },
  {
    id: "idn-fwd-3",
    leagueId: "idn-liga-1",
    name: "Ciro Alves",
    club: "Persib Bandung",
    position: "FWD",
    price: 8.4,
    form: 7.8,
    projectedPoints: 6.5,
    isInjured: false
  },
  {
    id: "idn-fwd-4",
    leagueId: "idn-liga-1",
    name: "Stefano Lilipaly",
    club: "Borneo FC",
    position: "FWD",
    price: 8.1,
    form: 7.3,
    projectedPoints: 6,
    isInjured: false
  },

  {
    id: "eng-gk-1",
    leagueId: "eng-premier-league",
    name: "Alisson Becker",
    club: "Liverpool",
    position: "GK",
    price: 6,
    form: 7.4,
    projectedPoints: 5.6,
    isInjured: false
  },
  {
    id: "eng-gk-2",
    leagueId: "eng-premier-league",
    name: "David Raya",
    club: "Arsenal",
    position: "GK",
    price: 5.8,
    form: 7.1,
    projectedPoints: 5.3,
    isInjured: false
  },
  {
    id: "eng-def-1",
    leagueId: "eng-premier-league",
    name: "Virgil van Dijk",
    club: "Liverpool",
    position: "DEF",
    price: 7,
    form: 8,
    projectedPoints: 6.1,
    isInjured: false
  },
  {
    id: "eng-def-2",
    leagueId: "eng-premier-league",
    name: "William Saliba",
    club: "Arsenal",
    position: "DEF",
    price: 6.7,
    form: 7.7,
    projectedPoints: 5.8,
    isInjured: false
  },
  {
    id: "eng-def-3",
    leagueId: "eng-premier-league",
    name: "Trent Alexander-Arnold",
    club: "Liverpool",
    position: "DEF",
    price: 7.4,
    form: 7.9,
    projectedPoints: 6.2,
    isInjured: false
  },
  {
    id: "eng-def-4",
    leagueId: "eng-premier-league",
    name: "Ben White",
    club: "Arsenal",
    position: "DEF",
    price: 6.2,
    form: 7,
    projectedPoints: 5.5,
    isInjured: false
  },
  {
    id: "eng-def-5",
    leagueId: "eng-premier-league",
    name: "Andy Robertson",
    club: "Liverpool",
    position: "DEF",
    price: 6.6,
    form: 7.3,
    projectedPoints: 5.7,
    isInjured: false
  },
  {
    id: "eng-mid-1",
    leagueId: "eng-premier-league",
    name: "Martin Odegaard",
    club: "Arsenal",
    position: "MID",
    price: 9.1,
    form: 8.2,
    projectedPoints: 6.8,
    isInjured: false
  },
  {
    id: "eng-mid-2",
    leagueId: "eng-premier-league",
    name: "Bukayo Saka",
    club: "Arsenal",
    position: "MID",
    price: 10.4,
    form: 8.6,
    projectedPoints: 7.4,
    isInjured: false
  },
  {
    id: "eng-mid-3",
    leagueId: "eng-premier-league",
    name: "Dominik Szoboszlai",
    club: "Liverpool",
    position: "MID",
    price: 8,
    form: 7.5,
    projectedPoints: 6.1,
    isInjured: false
  },
  {
    id: "eng-mid-4",
    leagueId: "eng-premier-league",
    name: "Alexis Mac Allister",
    club: "Liverpool",
    position: "MID",
    price: 7.5,
    form: 7.2,
    projectedPoints: 5.8,
    isInjured: false
  },
  {
    id: "eng-mid-5",
    leagueId: "eng-premier-league",
    name: "Declan Rice",
    club: "Arsenal",
    position: "MID",
    price: 7.1,
    form: 7,
    projectedPoints: 5.6,
    isInjured: false
  },
  {
    id: "eng-fwd-1",
    leagueId: "eng-premier-league",
    name: "Mohamed Salah",
    club: "Liverpool",
    position: "FWD",
    price: 12.8,
    form: 9,
    projectedPoints: 8,
    isInjured: false
  },
  {
    id: "eng-fwd-2",
    leagueId: "eng-premier-league",
    name: "Darwin Nunez",
    club: "Liverpool",
    position: "FWD",
    price: 8.5,
    form: 7.4,
    projectedPoints: 6.2,
    isInjured: false
  },
  {
    id: "eng-fwd-3",
    leagueId: "eng-premier-league",
    name: "Gabriel Jesus",
    club: "Arsenal",
    position: "FWD",
    price: 8.4,
    form: 7.1,
    projectedPoints: 6,
    isInjured: false
  },
  {
    id: "eng-fwd-4",
    leagueId: "eng-premier-league",
    name: "Kai Havertz",
    club: "Arsenal",
    position: "FWD",
    price: 8.1,
    form: 7.2,
    projectedPoints: 6.1,
    isInjured: false
  }
];

export const defaultLineup: TeamLineup = {
  leagueId: "idn-liga-1",
  goalkeeperId: "idn-gk-1",
  defenderIds: ["idn-def-1", "idn-def-2", "idn-def-3", "idn-def-4"],
  midfielderIds: ["idn-mid-1", "idn-mid-2", "idn-mid-3", "idn-mid-4"],
  forwardIds: ["idn-fwd-1", "idn-fwd-2"],
  substituteIds: ["idn-gk-2", "idn-def-5", "idn-mid-5", "idn-mid-6"],
  captainId: "idn-fwd-1",
  viceCaptainId: "idn-mid-1",
  updatedAt: "2026-02-10T06:00:00.000Z"
};
