import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { CustomLeague, CustomLeagueStanding } from "../../domain/fantasy/entities/CustomLeague";
import { LoadingState } from "../components/LoadingState";
import { RankMovementBadge } from "../components/RankMovementBadge";
import { useSession } from "../hooks/useSession";
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

    void appAlert.error("Standings Load Failed", standingsQuery.error.message);
  }, [standingsQuery.error]);

  const group = standingsQuery.data?.group ?? null;
  const standings = standingsQuery.data?.standings ?? [];

  const calculatedAt = useMemo(() => {
    const latest = standings.find((item) => item.lastCalculatedAt.trim());
    if (!latest) {
      return "-";
    }

    return new Date(latest.lastCalculatedAt).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, [standings]);

  const columns = useMemo<ColumnDef<CustomLeagueStanding>[]>(
    () => [
      {
        id: "rank",
        accessorKey: "rank",
        header: "Rank",
        cell: ({ row }) => `#${row.original.rank}`
      },
      {
        id: "teamName",
        header: "Team Name",
        cell: ({ row }) => resolveTeamName(row.original)
      },
      {
        id: "rankMovement",
        header: "Rank Movement",
        cell: ({ row }) => <RankMovementBadge value={row.original.rankMovement} />
      },
      {
        id: "points",
        accessorKey: "points",
        header: "Fantasy Squad Point"
      }
    ],
    []
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
            <h2>{group?.name ?? "Custom League"}</h2>
            <p className="muted">
              Invite Code: {group?.inviteCode ?? "-"} • Last Calculated: {calculatedAt}
            </p>
          </div>
          <Link to="/custom-leagues" className="secondary-button home-news-more">
            Back
          </Link>
        </div>
      </section>

      <section className="card page-section">
        {!hasSession ? <p className="muted">Session expired. Please login again.</p> : null}
        {hasSession && !isGroupProvided ? <p className="muted">Group id is missing.</p> : null}

        {hasSession && isGroupProvided && standingsQuery.isPending ? <LoadingState label="Loading standings" /> : null}
        {hasSession && isGroupProvided && !standingsQuery.isPending && standings.length === 0 ? (
          <p className="muted">No standings data yet.</p>
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
