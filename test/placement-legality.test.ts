import { describe, expect, test } from "vitest";

import {
  createInitialGameState,
  type GameState,
  type PlacementTarget,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import {
  evaluatePlacement,
  type PlacementIllegalReason,
} from "../src/game/placement-legality.ts";
import type { BoardCoordinate } from "../src/game/board-geometry.ts";

function pointState(
  counts: { readonly black?: number; readonly white?: number } = {},
  player: Player | null = null,
  secured = false,
): PointState {
  const pieceStack: readonly Player[] = [
    ...Array<Player>(counts.black ?? 0).fill("black"),
    ...Array<Player>(counts.white ?? 0).fill("white"),
  ];

  if (secured) {
    if (player === null) {
      throw new Error("A secured test point requires a player");
    }

    return { pieces: pieceStack, player, secured: true };
  }

  return { pieces: pieceStack, player, secured: false };
}

function withPoint(
  state: GameState,
  kind: PlacementTarget["kind"],
  coordinate: BoardCoordinate,
  point: PointState,
): GameState {
  const matrixName =
    kind === "supply-point" ? "supplyPoints" : "objectives";
  const matrix = state[matrixName].map((row, rowIndex) =>
    row.map((currentPoint, columnIndex) =>
      rowIndex === coordinate.row && columnIndex === coordinate.column
        ? point
        : currentPoint,
    ),
  );

  return { ...state, [matrixName]: matrix };
}

function withTurn(
  state: GameState,
  turn: Partial<GameState["turn"]>,
): GameState {
  return { ...state, turn: { ...state.turn, ...turn } };
}

function expectIllegal(
  state: GameState,
  target: PlacementTarget,
  reason: PlacementIllegalReason,
): void {
  expect(evaluatePlacement(state, target)).toEqual({ legal: false, reason });
}

describe("Supply Point placement legality", () => {
  const target = { kind: "supply-point", row: 1, column: 1 } as const;

  test("allows the first and second placement on a Supply Point", () => {
    const initialState = createInitialGameState(3, 12);
    const onePriorPlacement = withTurn(initialState, {
      placements: [target],
    });

    expect(evaluatePlacement(initialState, target)).toEqual({
      legal: true,
      kind: "supply-point",
    });
    expect(evaluatePlacement(onePriorPlacement, target)).toEqual({
      legal: true,
      kind: "supply-point",
    });
  });

  test("rejects a third placement on the same Supply Point this turn", () => {
    const state = withTurn(createInitialGameState(3, 12), {
      placements: [target, target],
    });

    expectIllegal(state, target, "supply-point-turn-limit-reached");
  });

  test("counts only matching Supply Point placements for the per-turn limit", () => {
    const state = withTurn(createInitialGameState(3, 12), {
      placements: [
        target,
        { kind: "objective", row: 1, column: 1 },
      ],
      usedSupplyPoints: [{ row: 1, column: 1 }],
    });

    expect(evaluatePlacement(state, target)).toEqual({
      legal: true,
      kind: "supply-point",
    });
  });

  test("rejects a Secured Supply Point", () => {
    const state = withPoint(
      createInitialGameState(3, 12),
      "supply-point",
      target,
      pointState({ black: 3 }, "black", true),
    );

    expectIllegal(state, target, "point-secured");
  });

  test("rejects when the active player already has three pieces there", () => {
    const state = withPoint(
      createInitialGameState(3, 12),
      "supply-point",
      target,
      pointState({ black: 3, white: 2 }, "black"),
    );

    expectIllegal(state, target, "player-point-limit-reached");
  });

  test("does not use the combined piece count as the point limit", () => {
    const state = withPoint(
      createInitialGameState(3, 12),
      "supply-point",
      target,
      pointState({ black: 2, white: 3 }, "white"),
    );

    expect(evaluatePlacement(state, target)).toEqual({
      legal: true,
      kind: "supply-point",
    });
  });

  test.each([
    { stack: [] as const, legal: true },
    { stack: ["black"] as const, legal: true },
    { stack: ["white", "black", "white", "black"] as const, legal: true },
    {
      stack: ["black", "white", "black", "white", "black"] as const,
      legal: false,
    },
  ])(
    "uses the active player's derived count in mixed stack $stack",
    ({ stack, legal }) => {
      const state = withPoint(
        createInitialGameState(3, 12),
        "supply-point",
        target,
        { pieces: stack, player: null, secured: false },
      );

      if (legal) {
        expect(evaluatePlacement(state, target)).toEqual({
          legal: true,
          kind: "supply-point",
        });
      } else {
        expectIllegal(state, target, "player-point-limit-reached");
      }
    },
  );

  test.each([
    { row: -1, column: 0 },
    { row: 0, column: -1 },
    { row: 4, column: 0 },
    { row: 0, column: 4 },
    { row: 0.5, column: 0 },
    { row: 0, column: 0.5 },
    { row: Number.NaN, column: 0 },
    { row: 0, column: Number.POSITIVE_INFINITY },
  ])("rejects invalid Supply Point coordinate $row,$column", (coordinate) => {
    expectIllegal(
      createInitialGameState(3, 12),
      { kind: "supply-point", ...coordinate },
      "invalid-target",
    );
  });

  test("rejects placement after three total turn placements", () => {
    const state = withTurn(createInitialGameState(3, 12), {
      placements: [
        { kind: "supply-point", row: 0, column: 0 },
        { kind: "supply-point", row: 0, column: 1 },
        { kind: "objective", row: 0, column: 0 },
      ],
    });

    expectIllegal(state, target, "turn-placement-limit-reached");
  });

  test("rejects placement when the active player has no pieces left", () => {
    const initialState = createInitialGameState(3, 12);
    const state = {
      ...initialState,
      remainingPieces: { ...initialState.remainingPieces, black: 0 },
    };

    expectIllegal(state, target, "no-remaining-pieces");
  });
});

describe("Objective placement legality", () => {
  const target = { kind: "objective", row: 1, column: 1 } as const;

  function withControlledSupplyPoints(
    coordinates: readonly BoardCoordinate[],
  ): GameState {
    return coordinates.reduce(
      (state, coordinate) =>
        withPoint(
          state,
          "supply-point",
          coordinate,
          pointState({ black: 1 }, "black"),
        ),
      createInitialGameState(3, 12),
    );
  }

  test("returns one eligible adjacent controlled Supply Point", () => {
    const state = withControlledSupplyPoints([{ row: 1, column: 1 }]);

    expect(evaluatePlacement(state, target)).toEqual({
      legal: true,
      kind: "objective",
      eligibleSupplyPoints: [{ row: 1, column: 1 }],
    });
  });

  test("preserves every eligible supporting choice", () => {
    const state = withControlledSupplyPoints([
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 2, column: 1 },
      { row: 2, column: 2 },
    ]);

    expect(evaluatePlacement(state, target)).toEqual({
      legal: true,
      kind: "objective",
      eligibleSupplyPoints: [
        { row: 1, column: 1 },
        { row: 1, column: 2 },
        { row: 2, column: 1 },
        { row: 2, column: 2 },
      ],
    });
  });

  test("rejects when no adjacent Supply Point is controlled by the player", () => {
    expectIllegal(
      createInitialGameState(3, 12),
      target,
      "no-eligible-supply-point",
    );
  });

  test("rejects when every controlled adjacent Supply Point is used", () => {
    const controlled = [
      { row: 1, column: 1 },
      { row: 2, column: 2 },
    ] as const;
    const state = withTurn(withControlledSupplyPoints(controlled), {
      usedSupplyPoints: controlled,
    });

    expectIllegal(state, target, "no-eligible-supply-point");
  });

  test("excludes used Supply Points while retaining unused choices", () => {
    const state = withTurn(
      withControlledSupplyPoints([
        { row: 1, column: 1 },
        { row: 1, column: 2 },
        { row: 2, column: 2 },
      ]),
      { usedSupplyPoints: [{ row: 1, column: 2 }] },
    );

    expect(evaluatePlacement(state, target)).toEqual({
      legal: true,
      kind: "objective",
      eligibleSupplyPoints: [
        { row: 1, column: 1 },
        { row: 2, column: 2 },
      ],
    });
  });

  test("rejects a Secured Objective", () => {
    let state = withControlledSupplyPoints([{ row: 1, column: 1 }]);
    state = withPoint(
      state,
      "objective",
      target,
      pointState({ white: 3 }, "white", true),
    );

    expectIllegal(state, target, "point-secured");
  });

  test("rejects when the active player already has three pieces there", () => {
    let state = withControlledSupplyPoints([{ row: 1, column: 1 }]);
    state = withPoint(
      state,
      "objective",
      target,
      pointState({ black: 3 }, "black"),
    );

    expectIllegal(state, target, "player-point-limit-reached");
  });

  test.each([
    { row: -1, column: 0 },
    { row: 0, column: -1 },
    { row: 3, column: 0 },
    { row: 0, column: 3 },
    { row: 0.5, column: 0 },
    { row: 0, column: Number.NaN },
    { row: Number.NEGATIVE_INFINITY, column: 0 },
  ])("rejects invalid Objective coordinate $row,$column", (coordinate) => {
    expectIllegal(
      createInitialGameState(3, 12),
      { kind: "objective", ...coordinate },
      "invalid-target",
    );
  });

  test.each([
    {
      target: { kind: "objective", row: 0, column: 0 } as const,
      support: { row: 0, column: 0 },
    },
    {
      target: { kind: "objective", row: 0, column: 2 } as const,
      support: { row: 0, column: 3 },
    },
    {
      target: { kind: "objective", row: 2, column: 0 } as const,
      support: { row: 3, column: 0 },
    },
    {
      target: { kind: "objective", row: 2, column: 2 } as const,
      support: { row: 3, column: 3 },
    },
  ])("uses correct adjacency at board edge/corner", ({ target, support }) => {
    const state = withControlledSupplyPoints([support]);

    expect(evaluatePlacement(state, target)).toEqual({
      legal: true,
      kind: "objective",
      eligibleSupplyPoints: [support],
    });
  });
});

test("placement evaluation leaves all game state unchanged", () => {
  let state = createInitialGameState(3, 12);
  state = withPoint(
    state,
    "supply-point",
    { row: 1, column: 1 },
    pointState({ black: 2, white: 1 }, "black"),
  );
  state = withPoint(
    state,
    "objective",
    { row: 1, column: 1 },
    pointState({ black: 1, white: 1 }, null),
  );
  state = withTurn(state, {
    placements: [{ kind: "supply-point", row: 0, column: 0 }],
    usedSupplyPoints: [{ row: 2, column: 2 }],
  });
  const snapshot = structuredClone(state);

  expect(evaluatePlacement(state, {
    kind: "objective",
    row: 1,
    column: 1,
  })).toEqual({
    legal: true,
    kind: "objective",
    eligibleSupplyPoints: [{ row: 1, column: 1 }],
  });
  expect(state).toEqual(snapshot);
});
