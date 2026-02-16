export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  category: "League" | "Transfer" | "Injury" | "Club";
  source: string;
};

const GLOBAL_NEWS: NewsItem[] = [
  {
    id: "news-001",
    title: "Liga 1 Deadline Window Confirmed for Gameweek 8",
    summary: "Managers are advised to lock transfers before Friday evening due to updated kickoff sequencing.",
    timestamp: "Mon, 16 Feb 2026 • 09:20 WIB",
    category: "League",
    source: "Fantasy Nusantara Desk"
  },
  {
    id: "news-002",
    title: "Top Differential Picks Emerging from Mid-Table Clubs",
    summary: "Several low-ownership midfielders now show strong xG+xA trends over the last three rounds.",
    timestamp: "Sun, 15 Feb 2026 • 20:10 WIB",
    category: "Transfer",
    source: "Scout Report"
  },
  {
    id: "news-003",
    title: "Injury Watch: Three Key Forwards Face Late Fitness Test",
    summary: "Medical staff updates are expected on matchday morning, and minute risk remains high.",
    timestamp: "Sun, 15 Feb 2026 • 14:35 WIB",
    category: "Injury",
    source: "Club Medical Brief"
  },
  {
    id: "news-004",
    title: "Pressing Teams Deliver Higher Bonus Potential This Month",
    summary: "Defenders in high-press systems recorded a spike in recoveries and passing bonus metrics.",
    timestamp: "Sat, 14 Feb 2026 • 18:05 WIB",
    category: "League",
    source: "Fantasy Analytics"
  },
  {
    id: "news-005",
    title: "Potential Rotation Alert Before Midweek Cup Tie",
    summary: "Managers should monitor lineups as several clubs may rotate fullbacks and wingers.",
    timestamp: "Sat, 14 Feb 2026 • 11:40 WIB",
    category: "Club",
    source: "Matchday Briefing"
  },
  {
    id: "news-006",
    title: "Price Riser Tracker: Four Assets Cross 10% Ownership Gain",
    summary: "Demand increased sharply after back-to-back returns, affecting wildcard and budget planning.",
    timestamp: "Fri, 13 Feb 2026 • 22:15 WIB",
    category: "Transfer",
    source: "Market Pulse"
  }
];

export const getGlobalNewsItems = (limit?: number): NewsItem[] => {
  return typeof limit === "number" ? GLOBAL_NEWS.slice(0, limit) : GLOBAL_NEWS;
};
