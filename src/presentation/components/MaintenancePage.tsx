import type { PublicAppConfig } from "../../domain/fantasy/entities/AppConfig";
import { Card } from "@/components/ui/card";

const formatWindow = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta"
  }).format(date);
};

export const MaintenancePage = ({ config }: { config: PublicAppConfig }) => {
  const { maintenance } = config;
  const startLabel = formatWindow(maintenance.startsAt);
  const endLabel = formatWindow(maintenance.endsAt);

  return (
    <div className="page-grid">
      <Card className="card home-hero">
        <p className="menu-home-kicker">Fantasy League</p>
        <h2>{maintenance.title}</h2>
        <p className="muted">{maintenance.message}</p>
        <div className="team-points-view-banner">
          <p><strong>Mode:</strong> {maintenance.mode === "read_only" ? "Read Only" : "Full Maintenance"}</p>
          {startLabel ? <p><strong>Start:</strong> {startLabel} WIB</p> : null}
          {endLabel ? <p><strong>Estimated End:</strong> {endLabel} WIB</p> : null}
        </div>
      </Card>
    </div>
  );
};
