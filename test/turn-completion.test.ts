import { describe, expect, test } from "vitest";

import {
  createInitialGameState,
  type GameState,
  type PlacementTarget,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import {
  completeTurn,
  type TurnCompletionRejectedReason,
  type TurnCompletionResult,
} from "../src/game/turn-completion.ts";

function pointState(
  black: number,
  white: number,
  player: Player | null = null,
  secured = false,
): PointState {
  const pieces = { black, white };

  if (secured) {
    if (player === null) {
      throw new Error("A secured test point requires a player");
    }

    return { pieces, secured: true, player };
  }

  return { pieces, secured: false, player };
}

function placements(count: number): readonly PlacementTarget[] {
  return Array.from({ length: count }, (_, column) => ({
    kind: "supply-point" as const,
    row: 0,
    column,
  }));
}

function completableState(activePlayer: Player): GameState {
  const state = createInitialGameState(3, 12);

  return {
    ...state,
    remainingPieces: { black: 7, white: 8 },
    supplyPoints: [
      [
        pointState(2, 1, "white"),
        pointState(1, 2, "black"),
        pointState(1, 1, "black"),
        pointState(3, 1, "white"),
      ],
      ...state.supplyPoints.slice(1),
    ],
    objectives: [
      [
        pointState(2, 1, "white"),
        pointState(1, 2, "black"),
        pointState(3, 2, "white"),
      ],
      ...state.objectives.slice(1),
    ],
    turn: {
      activePlayer,
      placements: placements(3),
      usedSupplyPoints: [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
      ],
    },
  };
}

function completedState(result: TurnCompletionResult): GameState {
  expect(result.completed).toBe(true);

  if (!result.completed) {
    throw new Error(`Expected turn completion, got ${result.reason}`);
  }

  return result.state;
}

function expectRejectedWithoutMutation(
  state: GameState,
  reason: TurnCompletionRejectedReason,
): void {
  const snapshot = structuredClone(state);
  const originalTurn = state.turn;
  const originalPlacements = state.turn.placements;
  const originalUsedSupplyPoints = state.turn.usedSupplyPoints;
  const originalSupplyPoints = state.supplyPoints;
  const originalObjectives = state.objectives;

  expect(completeTurn(state)).toEqual({ completed: false, reason });
  expect(state).toEqual(snapshot);
  expect(state.turn).toBe(originalTurn);
  expect(state.turn.activePlayer).toBe(snapshot.turn.activePlayer);
  expect(state.turn.placements).toBe(originalPlacements);
  expect(state.turn.usedSupplyPoints).toBe(originalUsedSupplyPoints);
  expect(state.supplyPoints).toBe(originalSupplyPoints);
  expect(state.objectives).toBe(originalObjectives);
}

describe("completeTurn", () => {
  test.each([
    { activePlayer: "black", nextPlayer: "white" },
    { activePlayer: "white", nextPlayer: "black" },
  ] as const)(
    "completes $activePlayer's three-placement turn for $nextPlayer",
    ({ activePlayer, nextPlayer }) => {
      const state = completableState(activePlayer);
      const nextState = completedState(completeTurn(state));

      expect(nextState.turn).toEqual({
        activePlayer: nextPlayer,
        placements: [],
        usedSupplyPoints: [],
      });
    },
  );

  test("resolves Control, Advantage, and Secured state before the next turn", () => {
    const nextState = completedState(completeTurn(completableState("black")));

    expect(nextState.turn.activePlayer).toBe("white");
    expect(nextState.supplyPoints[0]).toEqual([
      pointState(2, 1, "black"),
      pointState(1, 2, "white"),
      pointState(1, 1),
      pointState(3, 1, "black", true),
    ]);
    expect(nextState.objectives[0]).toEqual([
      pointState(2, 1, "black"),
      pointState(1, 2, "white"),
      pointState(3, 2, "black", true),
    ]);
  });

  test("preserves every board piece count and remaining piece count", () => {
    const state = completableState("white");
    const supplyPieceCounts = state.supplyPoints.map((row) =>
      row.map((point) => point.pieces),
    );
    const objectivePieceCounts = state.objectives.map((row) =>
      row.map((point) => point.pieces),
    );
    const nextState = completedState(completeTurn(state));

    expect(nextState.remainingPieces).toBe(state.remainingPieces);
    expect(nextState.remainingPieces).toEqual({ black: 7, white: 8 });
    nextState.supplyPoints.forEach((row, rowIndex) =>
      row.forEach((point, columnIndex) => {
        expect(point.pieces).toBe(supplyPieceCounts[rowIndex][columnIndex]);
      }),
    );
    nextState.objectives.forEach((row, rowIndex) =>
      row.forEach((point, columnIndex) => {
        expect(point.pieces).toBe(objectivePieceCounts[rowIndex][columnIndex]);
      }),
    );
  });

  test.each([0, 1, 2])(
    "rejects an incomplete turn with %i placements atomically",
    (placementCount) => {
      const baseState = completableState("black");
      const stalePoint = pointState(2, 1, "white");
      const state: GameState = {
        ...baseState,
        supplyPoints: [
          [stalePoint, ...baseState.supplyPoints[0].slice(1)],
          ...baseState.supplyPoints.slice(1),
        ],
        turn: {
          ...baseState.turn,
          placements: placements(placementCount),
        },
      };

      expectRejectedWithoutMutation(state, "incomplete-turn");
      expect(state.supplyPoints[0][0]).toBe(stalePoint);
      expect(state.supplyPoints[0][0].player).toBe("white");
      expect(state.turn.placements).toHaveLength(placementCount);
      expect(state.turn.usedSupplyPoints).toHaveLength(2);
    },
  );

  test("rejects an overfilled turn rather than recovering it", () => {
    const state = completableState("white");
    const overfilledState: GameState = {
      ...state,
      turn: { ...state.turn, placements: placements(4) },
    };

    expectRejectedWithoutMutation(overfilledState, "overfilled-turn");
  });

  test("does not mutate the completed turn's input graph", () => {
    const state = completableState("black");
    const snapshot = structuredClone(state);
    const originalTurn = state.turn;
    const originalPlacements = state.turn.placements;
    const originalUsedSupplyPoints = state.turn.usedSupplyPoints;
    const originalSupplyPoints = state.supplyPoints;
    const originalObjectives = state.objectives;
    const originalSupplyRows = [...state.supplyPoints];
    const originalObjectiveRows = [...state.objectives];
    const originalSupplyPieces = state.supplyPoints.map((row) =>
      row.map((point) => point.pieces),
    );
    const originalObjectivePieces = state.objectives.map((row) =>
      row.map((point) => point.pieces),
    );

    const nextState = completedState(completeTurn(state));

    expect(state).toEqual(snapshot);
    expect(nextState).not.toBe(state);
    expect(state.turn).toBe(originalTurn);
    expect(state.turn.placements).toBe(originalPlacements);
    expect(state.turn.usedSupplyPoints).toBe(originalUsedSupplyPoints);
    expect(state.supplyPoints).toBe(originalSupplyPoints);
    expect(state.objectives).toBe(originalObjectives);
    state.supplyPoints.forEach((row, rowIndex) => {
      expect(row).toBe(originalSupplyRows[rowIndex]);
      row.forEach((point, columnIndex) => {
        expect(point.pieces).toBe(originalSupplyPieces[rowIndex][columnIndex]);
      });
    });
    state.objectives.forEach((row, rowIndex) => {
      expect(row).toBe(originalObjectiveRows[rowIndex]);
      row.forEach((point, columnIndex) => {
        expect(point.pieces).toBe(originalObjectivePieces[rowIndex][columnIndex]);
      });
    });
  });
});
