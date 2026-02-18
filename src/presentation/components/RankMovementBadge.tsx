import type { RankMovement } from "../../domain/fantasy/entities/CustomLeague";

type RankMovementMeta = {
  icon: string;
  label: string;
};

const rankMovementMeta = (value: RankMovement): RankMovementMeta => {
  switch (value) {
    case "up":
      return { icon: "↑", label: "Up" };
    case "down":
      return { icon: "↓", label: "Down" };
    case "same":
      return { icon: "→", label: "Same" };
    case "new":
      return { icon: "•", label: "New" };
    default:
      return { icon: "?", label: "Unknown" };
  }
};

export const formatRankMovement = (value: RankMovement): string => {
  const meta = rankMovementMeta(value);
  return `${meta.icon} ${meta.label}`;
};

export const RankMovementBadge = ({ value }: { value: RankMovement }) => {
  const meta = rankMovementMeta(value);

  return (
    <span className={`movement-pill movement-${value}`} aria-label={`Movement ${meta.label}`}>
      <span className="movement-icon" aria-hidden="true">
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </span>
  );
};
