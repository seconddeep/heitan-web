import type { GameState } from "./game-state.ts";
import { resolvePointStates } from "./point-state-resolution.ts";

/** Resolves point states, switches players, and resets turn-local state. */
export function completeTurn(state: GameState): GameState {
  const resolvedState = resolvePointStates(state);
  const activePlayer = state.turn.activePlayer === "black" ? "white" : "black";

  return {
    ...resolvedState,
    turn: {
      activePlayer,
      placements: [],
      usedSupplyPoints: [],
    },
  };
}

/** Returns whether both players are out of pieces and the final turn is complete. */
export function isGameOver(state: GameState): boolean {
  return (
    state.remainingPieces.black === 0 &&
    state.remainingPieces.white === 0 &&
    state.turn.placements.length === 0
  );
}
