import { Card } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  value: string;
  caption?: string;
};

export const StatCard = ({ title, value, caption }: StatCardProps) => {
  return (
    <Card className="card stat-card">
      <p className="small-label">{title}</p>
      <h3>{value}</h3>
      {caption ? <p className="muted">{caption}</p> : null}
    </Card>
  );
};
