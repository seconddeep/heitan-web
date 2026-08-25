import { describe, expect, expectTypeOf, test } from "vitest";

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
