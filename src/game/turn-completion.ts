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
