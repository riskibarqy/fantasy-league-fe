import type { Player } from "../../domain/fantasy/entities/Player";

type PlayerRowProps = {
  player: Player;
  selected: boolean;
  onToggle: (playerId: string) => void;
};

export const PlayerRow = ({ player, selected, onToggle }: PlayerRowProps) => {
  return (
    <button
      type="button"
      className={`player-row ${selected ? "selected" : ""}`}
      onClick={() => onToggle(player.id)}
    >
      <span>
        <strong>{player.name}</strong>
        <small>
          {player.club} · {player.position}
        </small>
      </span>

      <span>
        <strong>{player.price.toFixed(1)}</strong>
        <small>{player.projectedPoints.toFixed(1)} pts</small>
      </span>
    </button>
  );
};
