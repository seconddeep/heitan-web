import { describe, expect, expectTypeOf, test } from "vitest";

import { createInitialGameState } from "../src/game/game-state.ts";
import type {
  GameState,
  Player,
  PointState,
  TurnState,
} from "../src/game/game-state.ts";
import type { BoardCoordinate } from "../src/game/board-geometry.ts";

describe("GameState type model", () => {
  test("represents board and in-progress turn state", () => {
    const gameState = {
      remainingPieces: {
        black: 4,
        white: 6,
      },
      supplyPoints: [
        [
          {
            pieces: { black: 3, white: 0 },
            secured: false,
            player: "black",
          },
          {
            pieces: { black: 0, white: 3 },
            secured: true,
            player: "white",
          },
        ],
        [
          {
            pieces: { black: 0, white: 0 },
            secured: false,
            player: null,
          },
          {
            pieces: { black: 1, white: 0 },
            secured: false,
            player: "black",
          },
        ],
      ],
      objectives: [
        [
          {
            pieces: { black: 2, white: 1 },
            secured: false,
            player: null,
          },
        ],
      ],
      turn: {
        activePlayer: "black",
        piecesPlaced: 2,
        usedSupplyPoints: [
          { row: 1, column: 1 },
        ],
      },
    } satisfies GameState;

    expectTypeOf(gameState).toMatchTypeOf<GameState>();
    expect(gameState.supplyPoints[0][1]).toMatchObject({
      secured: true,
      player: "white",
    });
    expect(gameState.turn).toMatchObject({
      activePlayer: "black",
      piecesPlaced: 2,
    });
    expect(gameState.turn.usedSupplyPoints).toEqual([
      { row: 1, column: 1 },
    ]);
  });

  test("uses shared point state and board coordinate types", () => {
    expectTypeOf<Player>().toEqualTypeOf<"black" | "white">();
    expectTypeOf<PointState["secured"]>().toEqualTypeOf<boolean>();
    expectTypeOf<PointState["player"]>().toEqualTypeOf<Player | null>();
    expectTypeOf<GameState["supplyPoints"]>().toEqualTypeOf<
      readonly (readonly PointState[])[]
    >();
    expectTypeOf<GameState["objectives"]>().toEqualTypeOf<
      readonly (readonly PointState[])[]
    >();
    expectTypeOf<TurnState["usedSupplyPoints"]>().toEqualTypeOf<
      readonly BoardCoordinate[]
    >();
  });
});

describe.each([3, 4, 7])(
  "createInitialGameState for a %i×%i board",
  (cellsPerSide) => {
    const piecesPerPlayer = cellsPerSide * 5;
    const gameState = createInitialGameState(
      cellsPerSide,
      piecesPerPlayer,
    );

    test("initializes the configured piece supply and turn", () => {
      expect(gameState.remainingPieces).toEqual({
        black: piecesPerPlayer,
        white: piecesPerPlayer,
      });
      expect(gameState.turn).toEqual({
        activePlayer: "black",
        piecesPlaced: 0,
        usedSupplyPoints: [],
      });
    });

    test("initializes the Supply Point matrix", () => {
      expect(gameState.supplyPoints).toHaveLength(cellsPerSide + 1);

      for (const row of gameState.supplyPoints) {
        expect(row).toHaveLength(cellsPerSide + 1);
        for (const pointState of row) {
          expect(pointState).toEqual({
            pieces: { black: 0, white: 0 },
            secured: false,
            player: null,
          });
        }
      }
    });

    test("initializes the Objective matrix", () => {
      expect(gameState.objectives).toHaveLength(cellsPerSide);

      for (const row of gameState.objectives) {
        expect(row).toHaveLength(cellsPerSide);
        for (const pointState of row) {
          expect(pointState).toEqual({
            pieces: { black: 0, white: 0 },
            secured: false,
            player: null,
          });
        }
      }
    });
  },
);

test("creates independent rows, PointStates, and piece counts", () => {
  const gameState = createInitialGameState(3, 10);

  expect(gameState.supplyPoints[0]).not.toBe(gameState.supplyPoints[1]);
  expect(gameState.supplyPoints[0][0]).not.toBe(
    gameState.supplyPoints[0][1],
  );
  expect(gameState.supplyPoints[0][0].pieces).not.toBe(
    gameState.supplyPoints[0][1].pieces,
  );
  expect(gameState.objectives[0]).not.toBe(gameState.objectives[1]);
  expect(gameState.objectives[0][0]).not.toBe(gameState.objectives[0][1]);
  expect(gameState.objectives[0][0].pieces).not.toBe(
    gameState.objectives[0][1].pieces,
  );
  expect(gameState.supplyPoints[0][0]).not.toBe(
    gameState.objectives[0][0],
  );
});

test("rejects invalid board sizes", () => {
  for (const cellsPerSide of [0, -1, 1.5, Number.NaN]) {
    expect(() => createInitialGameState(cellsPerSide, 10)).toThrow(
      new RangeError("Board size must be a positive integer"),
    );
  }
});

test("rejects invalid pieces per player", () => {
  for (const piecesPerPlayer of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    expect(() => createInitialGameState(4, piecesPerPlayer)).toThrow(
      new RangeError("Pieces per player must be a positive safe integer"),
    );
  }
});
