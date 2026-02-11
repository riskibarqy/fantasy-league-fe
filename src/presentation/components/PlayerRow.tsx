import type { Player } from "../../domain/fantasy/entities/Player";

type PlayerState = "none" | "starter" | "bench";

type PlayerRowProps = {
  player: Player;
  state: PlayerState;
  canStart: boolean;
  canBench: boolean;
  onStart: (playerId: string) => void;
  onBench: (playerId: string) => void;
  onRemove: (playerId: string) => void;
};

export const PlayerRow = ({
  player,
  state,
  canStart,
  canBench,
  onStart,
  onBench,
  onRemove
}: PlayerRowProps) => {
  return (
    <article className="player-row">
      <div>
        <strong>{player.name}</strong>
        <small>
          {player.club} · {player.position} · {player.price.toFixed(1)}
        </small>
      </div>

      <div className="player-actions">
        <span className={`player-state state-${state}`}>{state.toUpperCase()}</span>
        <button
          type="button"
          className="small-button"
          disabled={!canStart}
          onClick={() => onStart(player.id)}
        >
          Start
        </button>
        <button
          type="button"
          className="small-button"
          disabled={!canBench}
          onClick={() => onBench(player.id)}
        >
          Bench
        </button>
        <button type="button" className="small-button ghost-button" onClick={() => onRemove(player.id)}>
          Remove
        </button>
      </div>
    </article>
  );
};
