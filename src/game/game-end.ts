import type { GameState } from "./game-state.ts";

/** Returns whether both players are out of pieces and the final turn is complete. */
export function isGameOver(state: GameState): boolean {
  return (
    state.remainingPieces.black === 0 &&
    state.remainingPieces.white === 0 &&
    state.turn.placements.length === 0
  );
}
