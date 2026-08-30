import { describe, expect, test } from "vitest";

import {
  createInitialGameState,
  type GameState,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import {
  resolvePointState,
  resolvePointStates,
} from "../src/game/point-state-resolution.ts";

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

describe("resolvePointState", () => {
  test.each([
    { black: 0, white: 0, player: null, secured: false },
    { black: 1, white: 0, player: "black", secured: false },
    { black: 0, white: 1, player: "white", secured: false },
    { black: 1, white: 1, player: null, secured: false },
    { black: 2, white: 1, player: "black", secured: false },
    { black: 1, white: 2, player: "white", secured: false },
    { black: 2, white: 2, player: null, secured: false },
    { black: 3, white: 0, player: "black", secured: true },
    { black: 3, white: 2, player: "black", secured: true },
    { black: 0, white: 3, player: "white", secured: true },
    { black: 2, white: 3, player: "white", secured: true },
  ] as const)(
    "resolves $black-$white to player $player with secured=$secured",
    ({ black, white, player, secured }) => {
      const pieces: readonly Player[] = [
        ...Array<Player>(black).fill("black"),
        ...Array<Player>(white).fill("white"),
      ];
      const point: PointState = {
        pieces,
        secured: false,
        player: player === "black" ? "white" : "black",
      };

      expect(resolvePointState(point)).toEqual({ pieces, player, secured });
      expect(resolvePointState(point).pieces).toBe(pieces);
    },
  );

  test("preserves an already-Secured point unchanged", () => {
    const point = pointState(3, 2, "white", true);

    expect(resolvePointState(point)).toBe(point);
  });

  test("rejects the unreachable unsecured 3-3 state", () => {
    expect(() => resolvePointState(pointState(3, 3))).toThrow(
      new Error("Cannot resolve an unsecured point with a 3-3 piece count"),
    );
  });
});

describe("resolvePointStates", () => {
  function stateWithPointMatrices(): GameState {
    const state = createInitialGameState(3, 12);

    return {
      ...state,
      remainingPieces: { black: 7, white: 8 },
      supplyPoints: [
        [pointState(2, 1, "white"), pointState(1, 2, "black")],
        [pointState(2, 2, "black"), pointState(3, 1, "white")],
        [pointState(1, 3, "black"), pointState(3, 1, "black", true)],
      ],
      objectives: [
        [pointState(1, 0, "white"), pointState(0, 1, "black")],
        [pointState(1, 1, "black"), pointState(3, 2, "white")],
        [pointState(2, 3, "black"), pointState(0, 3, "white", true)],
      ],
      turn: {
        activePlayer: "white",
        placements: [
          { kind: "supply-point", row: 0, column: 0 },
          { kind: "supply-point", row: 0, column: 0 },
          { kind: "supply-point", row: 1, column: 1 },
          { kind: "objective", row: 1, column: 1 },
          { kind: "objective", row: 2, column: 0 },
        ],
        usedSupplyPoints: [{ row: 1, column: 1 }],
      },
    };
  }

  test("resolves Control only for changed Supply Points", () => {
    const resolved = resolvePointStates(stateWithPointMatrices());

    expect(resolved.supplyPoints).toEqual([
      [pointState(2, 1, "black"), pointState(1, 2, "black")],
      [pointState(2, 2, "black"), pointState(3, 1, "black", true)],
      [pointState(1, 3, "black"), pointState(3, 1, "black", true)],
    ]);
  });

  test("resolves Advantage only for changed Objectives", () => {
    const resolved = resolvePointStates(stateWithPointMatrices());

    expect(resolved.objectives).toEqual([
      [pointState(1, 0, "white"), pointState(0, 1, "black")],
      [pointState(1, 1, "black"), pointState(3, 2, "black", true)],
      [pointState(2, 3, "white", true), pointState(0, 3, "white", true)],
    ]);
  });

  test("preserves unchanged points by reference", () => {
    const state = stateWithPointMatrices();
    const resolved = resolvePointStates(state);

    expect(resolved.supplyPoints[0][1]).toBe(state.supplyPoints[0][1]);
    expect(resolved.supplyPoints[1][0]).toBe(state.supplyPoints[1][0]);
    expect(resolved.objectives[1][0]).toBe(state.objectives[1][0]);
    expect(resolved.objectives[2][1]).toBe(state.objectives[2][1]);
  });

  test("resolves a target with repeated placements only once", () => {
    const state = stateWithPointMatrices();
    let pieceCountReads = 0;
    const pieces = new Proxy<readonly Player[]>(
      ["black", "black", "white"],
      {
        get(target, property, receiver) {
          if (property === "filter") {
            pieceCountReads += 1;
          }

          return Reflect.get(target, property, receiver);
        },
      },
    );
    const repeatedTargetState: GameState = {
      ...state,
      supplyPoints: [
        [
          { pieces, secured: false, player: "white" },
          ...state.supplyPoints[0].slice(1),
        ],
        ...state.supplyPoints.slice(1),
      ],
      turn: {
        ...state.turn,
        placements: [
          { kind: "supply-point", row: 0, column: 0 },
          { kind: "supply-point", row: 0, column: 0 },
        ],
      },
    };

    const resolved = resolvePointStates(repeatedTargetState);

    expect(resolved.supplyPoints[0][0]).toEqual(
      pointState(2, 1, "black"),
    );
    expect(pieceCountReads).toBe(2);
  });

  test("does not recalculate an unchanged point", () => {
    const state = stateWithPointMatrices();
    const unreachablePoint = pointState(3, 3);
    const stateWithUnchangedUnreachablePoint: GameState = {
      ...state,
      objectives: [
        [unreachablePoint, ...state.objectives[0].slice(1)],
        ...state.objectives.slice(1),
      ],
    };

    const resolved = resolvePointStates(stateWithUnchangedUnreachablePoint);

    expect(resolved.objectives[0][0]).toBe(unreachablePoint);
  });

  test("returns the original matrices when the turn has no placements", () => {
    const state = stateWithPointMatrices();
    const stateWithoutPlacements: GameState = {
      ...state,
      turn: { ...state.turn, placements: [] },
    };

    const resolved = resolvePointStates(stateWithoutPlacements);

    expect(resolved.supplyPoints).toBe(state.supplyPoints);
    expect(resolved.objectives).toBe(state.objectives);
  });

  test("does not mutate point stacks or other GameState fields", () => {
    const state = stateWithPointMatrices();
    const snapshot = structuredClone(state);
    const supplyPieces = state.supplyPoints.map((row) =>
      row.map((point) => point.pieces),
    );
    const objectivePieces = state.objectives.map((row) =>
      row.map((point) => point.pieces),
    );

    const resolved = resolvePointStates(state);

    expect(state).toEqual(snapshot);
    expect(resolved).not.toBe(state);
    expect(resolved.remainingPieces).toBe(state.remainingPieces);
    expect(resolved.turn).toBe(state.turn);
    expect(resolved.turn.activePlayer).toBe("white");
    expect(resolved.turn.placements).toBe(state.turn.placements);
    expect(resolved.turn.usedSupplyPoints).toBe(state.turn.usedSupplyPoints);

    resolved.supplyPoints.forEach((row, rowIndex) =>
      row.forEach((point, columnIndex) =>
        expect(point.pieces).toBe(supplyPieces[rowIndex][columnIndex]),
      ),
    );
    resolved.objectives.forEach((row, rowIndex) =>
      row.forEach((point, columnIndex) =>
        expect(point.pieces).toBe(objectivePieces[rowIndex][columnIndex]),
      ),
    );
  });
});
