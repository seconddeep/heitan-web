import { describe, expect, test } from "vitest";

import {
  createInitialGameState,
  type GameState,
  type PlacementTarget,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import { completeTurn } from "../src/game/game-flow.ts";

function pointState(
  black: number,
  white: number,
  player: Player | null = null,
  secured = false,
): PointState {
  const pieces: readonly Player[] = [
    ...Array<Player>(black).fill("black"),
    ...Array<Player>(white).fill("white"),
  ];

  if (secured) {
    if (player === null) {
      throw new Error("A secured test point requires a player");
    }

    return { pieces, secured: true, player };
  }

  return { pieces, secured: false, player };
}

function placements(count: number): readonly PlacementTarget[] {
  const targets: readonly PlacementTarget[] = [
    { kind: "supply-point", row: 0, column: 0 },
    { kind: "objective", row: 0, column: 1 },
    { kind: "objective", row: 0, column: 2 },
  ];

  return targets.slice(0, count);
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

describe("completeTurn", () => {
  test.each([
    { activePlayer: "black", nextPlayer: "white" },
    { activePlayer: "white", nextPlayer: "black" },
  ] as const)(
    "completes $activePlayer's three-placement turn for $nextPlayer",
    ({ activePlayer, nextPlayer }) => {
      const state = completableState(activePlayer);
      const nextState = completeTurn(state);

      expect(nextState.turn).toEqual({
        activePlayer: nextPlayer,
        placements: [],
        usedSupplyPoints: [],
      });
    },
  );

  test("resolves Control, Advantage, and Secured state before the next turn", () => {
    const nextState = completeTurn(completableState("black"));

    expect(nextState.turn.activePlayer).toBe("white");
    expect(nextState.supplyPoints[0]).toEqual([
      pointState(2, 1, "black"),
      pointState(1, 2, "black"),
      pointState(1, 1, "black"),
      pointState(3, 1, "white"),
    ]);
    expect(nextState.objectives[0]).toEqual([
      pointState(2, 1, "white"),
      pointState(1, 2, "white"),
      pointState(3, 2, "black", true),
    ]);
  });

  test("preserves every board stack and remaining piece count", () => {
    const state = completableState("white");
    const supplyPieceStacks = state.supplyPoints.map((row) =>
      row.map((point) => point.pieces),
    );
    const objectivePieceStacks = state.objectives.map((row) =>
      row.map((point) => point.pieces),
    );
    const nextState = completeTurn(state);

    expect(nextState.remainingPieces).toBe(state.remainingPieces);
    expect(nextState.remainingPieces).toEqual({ black: 7, white: 8 });
    nextState.supplyPoints.forEach((row, rowIndex) =>
      row.forEach((point, columnIndex) => {
        expect(point.pieces).toBe(supplyPieceStacks[rowIndex][columnIndex]);
      }),
    );
    nextState.objectives.forEach((row, rowIndex) =>
      row.forEach((point, columnIndex) => {
        expect(point.pieces).toBe(objectivePieceStacks[rowIndex][columnIndex]);
      }),
    );
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

    const nextState = completeTurn(state);

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
