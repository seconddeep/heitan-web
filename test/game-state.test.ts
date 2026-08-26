import { describe, expect, expectTypeOf, test } from "vitest";

import {
  countPieces,
  createInitialGameState,
} from "../src/game/game-state.ts";
import type {
  GameState,
  PieceStack,
  PlacementTarget,
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
            pieces: ["black", "black", "black"],
            secured: false,
            player: "black",
          },
          {
            pieces: ["white", "white", "white"],
            secured: true,
            player: "white",
          },
        ],
        [
          {
            pieces: [],
            secured: false,
            player: null,
          },
          {
            pieces: ["black"],
            secured: false,
            player: "black",
          },
        ],
      ],
      objectives: [
        [
          {
            pieces: ["black", "white", "black"],
            secured: false,
            player: null,
          },
        ],
      ],
      turn: {
        activePlayer: "black",
        placements: [
          { kind: "supply-point", row: 1, column: 1 },
          { kind: "objective", row: 0, column: 0 },
        ],
        usedSupplyPoints: [
          { row: 0, column: 1 },
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
    });
    expect(gameState.turn.placements).toHaveLength(2);
    expect(gameState.turn.usedSupplyPoints).toEqual([
      { row: 0, column: 1 },
    ]);
    expect(gameState.turn.placements).toEqual([
      { kind: "supply-point", row: 1, column: 1 },
      { kind: "objective", row: 0, column: 0 },
    ]);
  });

  test("distinguishes Supply Point and Objective placement targets", () => {
    const targets = [
      { kind: "supply-point", row: 2, column: 3 },
      { kind: "objective", row: 1, column: 2 },
    ] as const satisfies readonly PlacementTarget[];

    expectTypeOf(targets).toMatchTypeOf<readonly PlacementTarget[]>();
    expect(targets).toEqual([
      { kind: "supply-point", row: 2, column: 3 },
      { kind: "objective", row: 1, column: 2 },
    ]);
  });

  test("uses shared point state and board coordinate types", () => {
    expectTypeOf<Player>().toEqualTypeOf<"black" | "white">();
    expectTypeOf<PointState["pieces"]>().toEqualTypeOf<PieceStack>();
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
    expectTypeOf<TurnState["placements"]>().toEqualTypeOf<
      readonly PlacementTarget[]
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
        placements: [],
        usedSupplyPoints: [],
      });
    });

    test("initializes the Supply Point matrix", () => {
      expect(gameState.supplyPoints).toHaveLength(cellsPerSide + 1);

      for (const row of gameState.supplyPoints) {
        expect(row).toHaveLength(cellsPerSide + 1);
        for (const pointState of row) {
          expect(pointState).toEqual({
            pieces: [],
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
            pieces: [],
            secured: false,
            player: null,
          });
        }
      }
    });
  },
);

test("creates independent rows, PointStates, and piece stacks", () => {
  const gameState = createInitialGameState(3, 10);
  const allPoints = [
    ...gameState.supplyPoints.flat(),
    ...gameState.objectives.flat(),
  ];

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
  expect(new Set(allPoints.map((point) => point.pieces)).size).toBe(
    allPoints.length,
  );
});

test("preserves different stack orders with the same player counts", () => {
  const first: PieceStack = ["black", "white", "black"];
  const second: PieceStack = ["black", "black", "white"];

  expect(first).not.toEqual(second);
  expect(countPieces(first, "black")).toBe(2);
  expect(countPieces(first, "white")).toBe(1);
  expect(countPieces(second, "black")).toBe(2);
  expect(countPieces(second, "white")).toBe(1);
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
