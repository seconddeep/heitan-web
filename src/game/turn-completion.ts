import type { GameState } from "./game-state.ts";
import { resolvePointStates } from "./point-state-resolution.ts";

export type TurnCompletionRejectedReason =
  | "incomplete-turn"
  | "overfilled-turn";

export type TurnCompletionResult =
  | {
      readonly completed: true;
      readonly state: GameState;
    }
  | {
      readonly completed: false;
      readonly reason: TurnCompletionRejectedReason;
    };

/** Resolves and completes a turn containing exactly three placements. */
export function completeTurn(state: GameState): TurnCompletionResult {
  const placementCount = state.turn.placements.length;

  if (placementCount < 3) {
    return { completed: false, reason: "incomplete-turn" };
  }

  if (placementCount > 3) {
    return { completed: false, reason: "overfilled-turn" };
  }

  const resolvedState = resolvePointStates(state);
  const activePlayer = state.turn.activePlayer === "black" ? "white" : "black";

  return {
    completed: true,
    state: {
      ...resolvedState,
      turn: {
        activePlayer,
        placements: [],
        usedSupplyPoints: [],
      },
    },
  };
}
