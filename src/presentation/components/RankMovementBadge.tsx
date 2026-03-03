import type { RankMovement } from "../../domain/fantasy/entities/CustomLeague";
import { useI18n } from "../hooks/useI18n";

type RankMovementMeta = {
  icon: string;
  labelKey: string;
};

const rankMovementMeta = (value: RankMovement): RankMovementMeta => {
  switch (value) {
    case "up":
      return { icon: "↑", labelKey: "movement.up" };
    case "down":
      return { icon: "↓", labelKey: "movement.down" };
    case "same":
      return { icon: "→", labelKey: "movement.same" };
    case "new":
      return { icon: "•", labelKey: "movement.new" };
    default:
      return { icon: "?", labelKey: "movement.unknown" };
  }
};

export const formatRankMovement = (value: RankMovement, format: (key: string) => string): string => {
  const meta = rankMovementMeta(value);
  return `${meta.icon} ${format(meta.labelKey)}`;
};

export const RankMovementBadge = ({ value }: { value: RankMovement }) => {
  const { t } = useI18n();
  const meta = rankMovementMeta(value);
  const label = t(meta.labelKey);

  return (
    <span className={`movement-pill movement-${value}`} aria-label={label}>
      <span className="movement-icon" aria-hidden="true">
        {meta.icon}
      </span>
      <span>{label}</span>
    </span>
  );
};
