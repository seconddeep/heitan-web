import type { GameState, PointState } from "./game-state.ts";

/**
 * Resolves the state shared by Supply Points and Objectives at turn completion.
 *
 * An unsecured 3-3 point is unreachable in legal play: only the active player
 * adds pieces during a turn, and a point is fixed as Secured as soon as either
 * player ends a turn with three pieces there.
 */
export function resolvePointState(point: PointState): PointState {
  if (point.secured) {
    return point;
  }

  const { black, white } = point.pieces;

  if (black === 3 && white === 3) {
    throw new Error("Cannot resolve an unsecured point with a 3-3 piece count");
  }

  if (black === white) {
    return {
      pieces: point.pieces,
      secured: false,
      player: null,
    };
  }

  const secured = black === 3 || white === 3;
  const player = black > white ? "black" : "white";

  return {
    pieces: point.pieces,
    secured,
    player,
  };
}

function resolvePointMatrix(
  matrix: readonly (readonly PointState[])[],
): readonly (readonly PointState[])[] {
  return matrix.map((row) => row.map(resolvePointState));
}

/** Resolves every point without performing other turn-completion behavior. */
export function resolvePointStates(state: GameState): GameState {
  return {
    ...state,
    supplyPoints: resolvePointMatrix(state.supplyPoints),
    objectives: resolvePointMatrix(state.objectives),
  };
}
