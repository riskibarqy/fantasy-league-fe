import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { CustomLeague, CustomLeagueStanding } from "../../domain/fantasy/entities/CustomLeague";
import { LoadingState } from "../components/LoadingState";
import { RankMovementBadge } from "../components/RankMovementBadge";
import { useSession } from "../hooks/useSession";
import { useI18n } from "../hooks/useI18n";
import { appAlert } from "../lib/appAlert";

const shortValue = (value: string): string => {
  return value.length <= 8 ? value : `${value.slice(0, 4)}...${value.slice(-2)}`;
};

const resolveTeamName = (item: CustomLeagueStanding): string => {
  const direct = item.teamName?.trim() || item.squadName?.trim();
  if (direct) {
    return direct;
  }

  if (item.squadId.trim()) {
    return `Squad ${shortValue(item.squadId)}`;
  }

  return `Manager ${shortValue(item.userId)}`;
};

type StandingsPayload = {
  group: CustomLeague;
  standings: CustomLeagueStanding[];
};

export const CustomLeagueStandingsPage = () => {
  const { t, dateLocale } = useI18n();
  const { groupId = "" } = useParams();
  const { getCustomLeague, getCustomLeagueStandings } = useContainer();
  const { session } = useSession();

  const accessToken = session?.accessToken?.trim() ?? "";
  const userId = session?.user.id?.trim() ?? "";
  const normalizedGroupId = groupId.trim();

  const standingsQuery = useQuery<StandingsPayload>({
    queryKey: ["custom-league-standings", normalizedGroupId, userId],
    enabled: Boolean(accessToken) && Boolean(userId) && Boolean(normalizedGroupId),
    staleTime: 60_000,
    queryFn: async () => {
      const [group, standings] = await Promise.all([
        getCustomLeague.execute(normalizedGroupId, accessToken),
        getCustomLeagueStandings.execute(normalizedGroupId, accessToken)
      ]);

      return {
        group,
        standings: [...standings].sort((left, right) => left.rank - right.rank)
      };
    }
  });

  useEffect(() => {
    if (!(standingsQuery.error instanceof Error)) {
      return;
    }

    void appAlert.error(t("customLeagueStandings.errorTitle"), standingsQuery.error.message);
  }, [standingsQuery.error, t]);

  const group = standingsQuery.data?.group ?? null;
  const standings = standingsQuery.data?.standings ?? [];

  const calculatedAt = useMemo(() => {
    const latest = standings.find((item) => item.lastCalculatedAt.trim());
    if (!latest) {
      return "-";
    }

    return new Date(latest.lastCalculatedAt).toLocaleString(dateLocale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, [dateLocale, standings]);

  const columns = useMemo<ColumnDef<CustomLeagueStanding>[]>(
    () => [
      {
        id: "rank",
        accessorKey: "rank",
        header: t("customLeagueStandings.table.rank"),
        cell: ({ row }) => `#${row.original.rank}`
      },
      {
        id: "teamName",
        header: t("customLeagueStandings.table.teamName"),
        cell: ({ row }) => resolveTeamName(row.original)
      },
      {
        id: "rankMovement",
        header: t("customLeagueStandings.table.rankMovement"),
        cell: ({ row }) => <RankMovementBadge value={row.original.rankMovement} />
      },
      {
        id: "points",
        accessorKey: "points",
        header: t("customLeagueStandings.table.points")
      }
    ],
    [t]
  );

  const table = useReactTable({
    data: standings,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const hasSession = Boolean(accessToken) && Boolean(userId);
  const isGroupProvided = Boolean(normalizedGroupId);

  return (
    <div className="page-grid">
      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>{group?.name ?? t("customLeagueStandings.titleFallback")}</h2>
            <p className="muted">
              {t("customLeagueStandings.meta", { code: group?.inviteCode ?? "-", calculatedAt })}
            </p>
          </div>
          <Link to="/custom-leagues" className="secondary-button home-news-more">
            {t("customLeagueStandings.back")}
          </Link>
        </div>
      </section>

      <section className="card page-section">
        {!hasSession ? <p className="muted">{t("customLeagueStandings.sessionExpired")}</p> : null}
        {hasSession && !isGroupProvided ? <p className="muted">{t("customLeagueStandings.groupMissing")}</p> : null}

        {hasSession && isGroupProvided && standingsQuery.isPending ? (
          <LoadingState label={t("customLeagueStandings.loading")} />
        ) : null}
        {hasSession && isGroupProvided && !standingsQuery.isPending && standings.length === 0 ? (
          <p className="muted">{t("customLeagueStandings.empty")}</p>
        ) : null}

        {hasSession && isGroupProvided && !standingsQuery.isPending && standings.length > 0 ? (
          <div className="team-picker-table-wrap custom-standing-wrap">
            <table className="team-picker-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
