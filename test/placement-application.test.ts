import { describe, expect, test } from "vitest";

import type { BoardCoordinate } from "../src/game/board-geometry.ts";
import {
  createInitialGameState,
  type GameState,
  type PlacementTarget,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import {
  applyPlacement,
  type PlacementApplicationIllegalReason,
  type PlacementApplicationResult,
} from "../src/game/placement-application.ts";

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

function appliedState(result: PlacementApplicationResult): GameState {
  expect(result.applied).toBe(true);

  if (!result.applied) {
    throw new Error(`Expected placement to apply, got ${result.reason}`);
  }

  return result.state;
}

function expectRejectedWithoutMutation(
  state: GameState,
  target: PlacementTarget,
  reason: PlacementApplicationIllegalReason,
  supportingSupplyPoint?: BoardCoordinate,
): void {
  const snapshot = structuredClone(state);

  expect(applyPlacement(state, target, supportingSupplyPoint)).toEqual({
    applied: false,
    reason,
  });
  expect(state).toEqual(snapshot);
}

function withControlledSupplyPoints(
  state: GameState,
  coordinates: readonly BoardCoordinate[],
): GameState {
  return coordinates.reduce(
    (currentState, coordinate) =>
      withPoint(
        currentState,
        "supply-point",
        coordinate,
        pointState({ black: 1 }, "black"),
      ),
    state,
  );
}

describe("Supply Point placement application", () => {
  const target = { kind: "supply-point", row: 1, column: 1 } as const;

  test("updates only the active player's immediate placement state", () => {
    let state = createInitialGameState(3, 12);
    state = withPoint(
      state,
      "supply-point",
      target,
      pointState({ black: 1, white: 2 }, "white"),
    );
    state = withTurn(state, {
      usedSupplyPoints: [{ row: 0, column: 0 }],
    });
    const originalSnapshot = structuredClone(state);
    const originalTarget = state.supplyPoints[1][1];
    const originalTargetRow = state.supplyPoints[1];
    const unrelatedPoint = state.supplyPoints[0][0];

    const nextState = appliedState(applyPlacement(state, target));

    expect(nextState.supplyPoints[1][1]).toEqual({
      pieces: ["black", "white", "white", "black"],
      player: "white",
      secured: false,
    });
    expect(nextState.remainingPieces).toEqual({ black: 11, white: 12 });
    expect(nextState.turn).toEqual({
      activePlayer: "black",
      placements: [target],
      usedSupplyPoints: [{ row: 0, column: 0 }],
    });
    expect(nextState.objectives).toBe(state.objectives);
    expect(nextState.supplyPoints[0]).toBe(state.supplyPoints[0]);
    expect(nextState.supplyPoints[0][0]).toBe(unrelatedPoint);
    expect(nextState.supplyPoints[1]).not.toBe(originalTargetRow);
    expect(nextState.supplyPoints[1][1]).not.toBe(originalTarget);
    expect(nextState.supplyPoints[1][1].pieces).not.toBe(
      originalTarget.pieces,
    );
    expect(state).toEqual(originalSnapshot);
  });

  test("rejects a supporting Supply Point for a Supply target", () => {
    const state = createInitialGameState(3, 12);

    expectRejectedWithoutMutation(
      state,
      target,
      "unexpected-supporting-supply-point",
      { row: 1, column: 1 },
    );
  });

  test("appends sequential placements in bottom-to-top order", () => {
    let state = createInitialGameState(3, 12);

    state = appliedState(applyPlacement(state, target));
    state = withTurn(state, { activePlayer: "white", placements: [] });
    state = appliedState(applyPlacement(state, target));
    state = withTurn(state, { activePlayer: "black", placements: [] });
    state = appliedState(applyPlacement(state, target));

    expect(state.supplyPoints[1][1].pieces).toEqual([
      "black",
      "white",
      "black",
    ]);
  });
});

describe("Objective placement application", () => {
  const target = { kind: "objective", row: 1, column: 1 } as const;

  test("applies a placement using the sole eligible Supply Point", () => {
    let state = createInitialGameState(3, 12);
    state = withControlledSupplyPoints(state, [{ row: 1, column: 1 }]);
    state = withPoint(
      state,
      "objective",
      target,
      pointState({ black: 1, white: 2 }, "white"),
    );
    const originalSnapshot = structuredClone(state);

    const nextState = appliedState(
      applyPlacement(state, target, { row: 1, column: 1 }),
    );

    expect(nextState.objectives[1][1]).toEqual({
      pieces: ["black", "white", "white", "black"],
      player: "white",
      secured: false,
    });
    expect(nextState.remainingPieces).toEqual({ black: 11, white: 12 });
    expect(nextState.turn).toEqual({
      activePlayer: "black",
      placements: [target],
      usedSupplyPoints: [{ row: 1, column: 1 }],
    });
    expect(nextState.supplyPoints).toBe(state.supplyPoints);
    expect(state).toEqual(originalSnapshot);
  });

  test("records exactly the caller-selected choice when several are eligible", () => {
    const state = withControlledSupplyPoints(createInitialGameState(3, 12), [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 2, column: 1 },
    ]);

    const nextState = appliedState(
      applyPlacement(state, target, { row: 2, column: 1 }),
    );

    expect(nextState.turn.usedSupplyPoints).toEqual([
      { row: 2, column: 1 },
    ]);
    expect(nextState.turn.usedSupplyPoints).not.toContainEqual({
      row: 1,
      column: 1,
    });
    expect(nextState.turn.usedSupplyPoints).not.toContainEqual({
      row: 1,
      column: 2,
    });
    expect(nextState.objectives[1][1].pieces).toEqual(["black"]);
    expect(nextState.turn.placements).toEqual([target]);
    expect(nextState.remainingPieces.black).toBe(11);
    expect(nextState.objectives[1][1]).toMatchObject({
      player: null,
      secured: false,
    });
  });

  test("requires the caller to select a supporting Supply Point", () => {
    const state = withControlledSupplyPoints(createInitialGameState(3, 12), [
      { row: 1, column: 1 },
    ]);

    expectRejectedWithoutMutation(
      state,
      target,
      "supporting-supply-point-required",
    );
  });

  test.each([
    {
      name: "adjacent but not controlled",
      selected: { row: 1, column: 2 },
      usedSupplyPoints: [],
    },
    {
      name: "already used",
      selected: { row: 1, column: 2 },
      usedSupplyPoints: [{ row: 1, column: 2 }],
    },
    {
      name: "not adjacent",
      selected: { row: 0, column: 0 },
      usedSupplyPoints: [],
    },
  ])("rejects a selected Supply Point that is $name", ({
    selected,
    usedSupplyPoints,
  }) => {
    let state = withControlledSupplyPoints(createInitialGameState(3, 12), [
      { row: 1, column: 1 },
    ]);

    if (selected.row === 1 && selected.column === 2) {
      state = withPoint(
        state,
        "supply-point",
        selected,
        pointState(
          { white: 1 },
          usedSupplyPoints.length === 0 ? "white" : "black",
        ),
      );
    }

    state = withTurn(state, { usedSupplyPoints });

    expectRejectedWithoutMutation(
      state,
      target,
      "supporting-supply-point-not-eligible",
      selected,
    );
  });

  test("validates the selection against evaluatePlacement's eligible list", () => {
    const state = withControlledSupplyPoints(createInitialGameState(3, 12), [
      { row: 1, column: 1 },
      { row: 2, column: 2 },
    ]);

    expectRejectedWithoutMutation(
      state,
      target,
      "supporting-supply-point-not-eligible",
      { row: 0, column: 3 },
    );
  });
});

describe("illegal placement application", () => {
  const supplyTarget = {
    kind: "supply-point",
    row: 1,
    column: 1,
  } as const;
  const objectiveTarget = {
    kind: "objective",
    row: 1,
    column: 1,
  } as const;

  test("passes through representative evaluatePlacement failures atomically", () => {
    const initialState = createInitialGameState(3, 12);
    const cases: readonly {
      state: GameState;
      target: PlacementTarget;
      reason: PlacementApplicationIllegalReason;
    }[] = [
      {
        state: initialState,
        target: { kind: "supply-point", row: -1, column: 0 },
        reason: "invalid-target",
      },
      {
        state: withPoint(
          initialState,
          "supply-point",
          supplyTarget,
          pointState({ black: 3 }, "black", true),
        ),
        target: supplyTarget,
        reason: "point-secured",
      },
      {
        state: {
          ...initialState,
          remainingPieces: { black: 0, white: 12 },
        },
        target: supplyTarget,
        reason: "no-remaining-pieces",
      },
      {
        state: withTurn(initialState, {
          placements: [
            { kind: "supply-point", row: 0, column: 0 },
            { kind: "supply-point", row: 0, column: 1 },
            { kind: "supply-point", row: 0, column: 2 },
          ],
        }),
        target: supplyTarget,
        reason: "turn-placement-limit-reached",
      },
      {
        state: withTurn(initialState, {
          placements: [supplyTarget, supplyTarget],
        }),
        target: supplyTarget,
        reason: "supply-point-turn-limit-reached",
      },
      {
        state: initialState,
        target: objectiveTarget,
        reason: "no-eligible-supply-point",
      },
    ];

    for (const placementCase of cases) {
      expectRejectedWithoutMutation(
        placementCase.state,
        placementCase.target,
        placementCase.reason,
      );
    }
  });

  test("does not complete or resolve the turn after the third placement", () => {
    let state = withControlledSupplyPoints(createInitialGameState(3, 12), [
      { row: 1, column: 1 },
    ]);
    state = withPoint(
      state,
      "supply-point",
      supplyTarget,
      pointState({ black: 2 }, "white"),
    );
    state = withTurn(state, {
      placements: [
        { kind: "supply-point", row: 0, column: 0 },
        { kind: "objective", row: 0, column: 0 },
      ],
      usedSupplyPoints: [{ row: 0, column: 0 }],
    });

    const nextState = appliedState(applyPlacement(state, supplyTarget));

    expect(nextState.turn.activePlayer).toBe("black");
    expect(nextState.turn.placements).toHaveLength(3);
    expect(nextState.turn.usedSupplyPoints).toEqual([
      { row: 0, column: 0 },
    ]);
    expect(nextState.supplyPoints[1][1]).toEqual({
      pieces: ["black", "black", "black"],
      player: "white",
      secured: false,
    });
  });
});
