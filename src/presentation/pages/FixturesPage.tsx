import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { FixtureCard } from "../components/FixtureCard";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

export const FixturesPage = () => {
  const { getFixtures } = useContainer();
  const {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    isLoading: isLeaguesLoading,
    errorMessage: leagueErrorMessage
  } = useLeagueSelection();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isFixturesLoading, setIsFixturesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameweekPageIndex, setGameweekPageIndex] = useState(0);
  const activeGameweekButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (leagueErrorMessage) {
      void appAlert.error("League Load Failed", leagueErrorMessage);
    }
  }, [leagueErrorMessage]);

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Fixtures Load Failed", errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!selectedLeagueId) {
      setFixtures([]);
      return;
    }

    let mounted = true;

    const loadFixtures = async () => {
      try {
        setIsFixturesLoading(true);
        const result = await getOrLoadCached({
          key: cacheKeys.fixtures(selectedLeagueId),
          ttlMs: cacheTtlMs.fixtures,
          loader: () => getFixtures.execute(selectedLeagueId),
          allowStaleOnError: true
        });
        if (!mounted) {
          return;
        }

        setFixtures(result);
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load fixtures.");
      } finally {
        if (mounted) {
          setIsFixturesLoading(false);
        }
      }
    };

    void loadFixtures();

    return () => {
      mounted = false;
    };
  }, [getFixtures, selectedLeagueId]);

  const selectedLeagueName = useMemo(() => {
    return leagues.find((league) => league.id === selectedLeagueId)?.name ?? "League";
  }, [leagues, selectedLeagueId]);

  const groupedByGameweek = useMemo(() => {
    const sorted = [...fixtures].sort(
      (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
    );

    const grouped = new Map<number, Fixture[]>();
    for (const fixture of sorted) {
      const bucket = grouped.get(fixture.gameweek) ?? [];
      bucket.push(fixture);
      grouped.set(fixture.gameweek, bucket);
    }

    return [...grouped.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([gameweek, items]) => ({ gameweek, items }));
  }, [fixtures]);

  const nearestGameweek = useMemo(() => {
    if (fixtures.length === 0) {
      return null;
    }

    const now = Date.now();
    let nearestFixture: Fixture | null = null;
    let smallestDiff = Number.POSITIVE_INFINITY;

    for (const fixture of fixtures) {
      const fixtureAt = new Date(fixture.kickoffAt).getTime();
      const diff = Math.abs(fixtureAt - now);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        nearestFixture = fixture;
        continue;
      }

      // Prefer future fixture when equally near to "now".
      if (
        diff === smallestDiff &&
        nearestFixture &&
        fixtureAt >= now &&
        new Date(nearestFixture.kickoffAt).getTime() < now
      ) {
        nearestFixture = fixture;
      }
    }

    return nearestFixture?.gameweek ?? null;
  }, [fixtures]);

  useEffect(() => {
    if (groupedByGameweek.length === 0) {
      setGameweekPageIndex(0);
      return;
    }

    const nearestIndex =
      nearestGameweek === null
        ? -1
        : groupedByGameweek.findIndex((group) => group.gameweek === nearestGameweek);

    setGameweekPageIndex(nearestIndex >= 0 ? nearestIndex : 0);
  }, [groupedByGameweek, nearestGameweek, selectedLeagueId]);

  useEffect(() => {
    if (!activeGameweekButtonRef.current) {
      return;
    }

    activeGameweekButtonRef.current.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }, [gameweekPageIndex, groupedByGameweek.length]);

  const activeGameweekGroup = groupedByGameweek[gameweekPageIndex] ?? null;
  const activeGameweek = activeGameweekGroup?.gameweek ?? null;
  const totalGameweeks = groupedByGameweek.length;

  return (
    <div className="page-grid">
      <Card className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2 className="section-icon-title">
              <CalendarDays className="inline-icon" aria-hidden="true" />
              Fixtures
            </h2>
            <p className="muted">Track schedule by competition.</p>
          </div>
        </div>

        <div className="page-filter-grid">
          <label>
            League
            <Select
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
              disabled={isLeaguesLoading}
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {isLeaguesLoading ? <LoadingState label="Loading leagues" inline compact /> : null}
      </Card>

      <Card className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h3>{selectedLeagueName}</h3>
            <p className="muted">
              {activeGameweekGroup ? `${activeGameweekGroup.items.length} matches in GW ${activeGameweek}` : "0 matches"}
              {fixtures.length > 0 ? ` • ${fixtures.length} total` : ""}
            </p>
          </div>
        </div>

        {totalGameweeks > 0 ? (
          <div className="fixtures-pagination">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="fixtures-page-nav"
              onClick={() => setGameweekPageIndex((previous) => Math.max(0, previous - 1))}
              disabled={gameweekPageIndex <= 0}
            >
              <ChevronLeft className="inline-icon" aria-hidden="true" />
              Prev
            </Button>

            <div className="fixtures-gw-strip" role="tablist" aria-label="Gameweek list">
              {groupedByGameweek.map((group, index) => {
                const isActive = index === gameweekPageIndex;
                return (
                  <button
                    key={group.gameweek}
                    ref={isActive ? activeGameweekButtonRef : null}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`fixtures-gw-chip ${isActive ? "active" : ""}`}
                    onClick={() => setGameweekPageIndex(index)}
                  >
                    GW {group.gameweek}
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="fixtures-page-nav"
              onClick={() =>
                setGameweekPageIndex((previous) => Math.min(groupedByGameweek.length - 1, previous + 1))
              }
              disabled={gameweekPageIndex >= groupedByGameweek.length - 1}
            >
              Next
              <ChevronRight className="inline-icon" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {isFixturesLoading ? <LoadingState label="Loading fixtures" /> : null}
        {isFixturesLoading ? (
          <>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </>
        ) : null}
        <div className="fixtures-list">
          {!isFixturesLoading && fixtures.length === 0 ? <p className="muted">No fixtures found.</p> : null}
          {(activeGameweekGroup?.items ?? []).map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      </Card>
    </div>
  );
};
