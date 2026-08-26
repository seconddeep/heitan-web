import { describe, expect, test } from "vitest";

import { isGameOver } from "../src/game/game-end.ts";
import {
  createInitialGameState,
  type GameState,
  type PieceCounts,
  type PlacementTarget,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import {
  completeTurn,
  type TurnCompletionResult,
} from "../src/game/turn-completion.ts";

function placements(count: number): readonly PlacementTarget[] {
  return Array.from({ length: count }, (_, column) => ({
    kind: "supply-point" as const,
    row: 0,
    column,
  }));
}

function gameState(
  remainingPieces: PieceCounts,
  placementCount = 0,
  activePlayer: Player = "black",
): GameState {
  const state = createInitialGameState(3, 12);

  return {
    ...state,
    remainingPieces,
    turn: {
      activePlayer,
      placements: placements(placementCount),
      usedSupplyPoints: [{ row: 1, column: 1 }],
    },
  };
}

function pointState(
  black: number,
  white: number,
  player: Player | null,
  secured = false,
): PointState {
  if (secured) {
    if (player === null) {
      throw new Error("A secured test point requires a player");
    }

    return { pieces: { black, white }, secured: true, player };
  }

  return { pieces: { black, white }, secured: false, player };
}

function completedState(result: TurnCompletionResult): GameState {
  expect(result.completed).toBe(true);

  if (!result.completed) {
    throw new Error(`Expected turn completion, got ${result.reason}`);
  }

  return result.state;
}

describe("isGameOver", () => {
  test.each([
    {
      remainingPieces: { black: 4, white: 6 },
      description: "both players have pieces",
    },
    {
      remainingPieces: { black: 0, white: 6 },
      description: "only White has pieces",
    },
    {
      remainingPieces: { black: 4, white: 0 },
      description: "only Black has pieces",
    },
  ] as const)("returns false when $description", ({ remainingPieces }) => {
    expect(isGameOver(gameState(remainingPieces))).toBe(false);
  });

  test.each([1, 2, 3])(
    "returns false with no remaining pieces while %i final-turn placements remain",
    (placementCount) => {
      expect(isGameOver(gameState({ black: 0, white: 0 }, placementCount))).toBe(
        false,
      );
    },
  );

  test("returns true after final turn completion clears placements", () => {
    const inProgressState = gameState({ black: 0, white: 0 }, 3, "white");

    expect(isGameOver(inProgressState)).toBe(false);

    const finalState = completedState(completeTurn(inProgressState));

    expect(finalState.turn.placements).toEqual([]);
    expect(isGameOver(finalState)).toBe(true);
  });

  test.each(["black", "white"] as const)(
    "returns true with %s active after the final turn",
    (activePlayer) => {
      expect(
        isGameOver(gameState({ black: 0, white: 0 }, 0, activePlayer)),
      ).toBe(true);
    },
  );

  test("ignores board state and turn-local Supply Point usage", () => {
    const state = gameState({ black: 0, white: 0 });
    const variedState: GameState = {
      ...state,
      supplyPoints: [
        [
          pointState(3, 0, "black", true),
          pointState(1, 2, "white"),
          ...state.supplyPoints[0].slice(2),
        ],
        ...state.supplyPoints.slice(1),
      ],
      objectives: [
        [
          pointState(0, 3, "white", true),
          pointState(2, 1, "black"),
          ...state.objectives[0].slice(2),
        ],
        ...state.objectives.slice(1),
      ],
      turn: {
        ...state.turn,
        usedSupplyPoints: [
          { row: 0, column: 0 },
          { row: 2, column: 2 },
        ],
      },
    };

    expect(isGameOver(state)).toBe(true);
    expect(isGameOver(variedState)).toBe(true);
  });

  test("does not mutate any game-state data", () => {
    const state = gameState({ black: 0, white: 0 }, 2, "white");
    const snapshot = structuredClone(state);
    const originalRemainingPieces = state.remainingPieces;
    const originalSupplyPoints = state.supplyPoints;
    const originalObjectives = state.objectives;
    const originalTurn = state.turn;
    const originalPlacements = state.turn.placements;
    const originalUsedSupplyPoints = state.turn.usedSupplyPoints;

    isGameOver(state);

    expect(state).toEqual(snapshot);
    expect(state.remainingPieces).toBe(originalRemainingPieces);
    expect(state.supplyPoints).toBe(originalSupplyPoints);
    expect(state.objectives).toBe(originalObjectives);
    expect(state.turn).toBe(originalTurn);
    expect(state.turn.placements).toBe(originalPlacements);
    expect(state.turn.usedSupplyPoints).toBe(originalUsedSupplyPoints);
  });
});
