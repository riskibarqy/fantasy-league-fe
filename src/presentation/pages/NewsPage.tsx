import { useMemo, useState } from "react";
import type { NewsItem } from "./newsFeed";
import { getGlobalNewsItems } from "./newsFeed";

type NewsFilter = "All" | NewsItem["category"];

export const NewsPage = () => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NewsFilter>("All");
  const newsItems = useMemo(() => getGlobalNewsItems(), []);

  const filteredNews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return newsItems.filter((item) => {
      if (filter !== "All" && item.category !== filter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.summary.toLowerCase().includes(normalizedQuery) ||
        item.source.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [filter, newsItems, query]);

  return (
    <div className="page-grid">
      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>Global News</h2>
            <p className="muted">League-wide updates, transfer signals, and player availability notes.</p>
          </div>
        </div>

        <div className="page-filter-grid">
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, summary, or source"
            />
          </label>
          <label>
            Category
            <select value={filter} onChange={(event) => setFilter(event.target.value as NewsFilter)}>
              <option value="All">All</option>
              <option value="League">League</option>
              <option value="Transfer">Transfer</option>
              <option value="Injury">Injury</option>
              <option value="Club">Club</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h3>Latest Headlines</h3>
            <p className="muted">{filteredNews.length} articles</p>
          </div>
        </div>

        <div className="home-news-list">
          {filteredNews.map((item) => (
            <article key={item.id} className="home-news-item">
              <div className="news-item-meta">
                <span className="small-label">{item.category}</span>
                <span className="small-label">{item.timestamp}</span>
              </div>
              <strong>{item.title}</strong>
              <p className="muted">{item.summary}</p>
              <p className="small-label">Source: {item.source}</p>
            </article>
          ))}
          {filteredNews.length === 0 ? <p className="muted">No news found for this filter.</p> : null}
        </div>
      </section>
    </div>
  );
};
