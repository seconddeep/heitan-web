import { describe, expect, test } from "vitest";

import {
  calculateGameResult,
  calculateObjectiveScores,
} from "../src/game/game-result.ts";
import type {
  GameState,
  Player,
  PointState,
} from "../src/game/game-state.ts";

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

function gameState(
  objectives: readonly (readonly PointState[])[],
  supplyPoints: readonly (readonly PointState[])[] = [],
  finished = true,
): GameState {
  return {
    remainingPieces: finished
      ? { black: 0, white: 0 }
      : { black: 1, white: 0 },
    supplyPoints,
    objectives,
    turn: {
      activePlayer: "black",
      placements: [],
      usedSupplyPoints: [],
    },
  };
}

describe("calculateObjectiveScores", () => {
  test("counts secured and Advantage Objectives for both players", () => {
    const state = gameState([
      [
        pointState(3, 2, "black", true),
        pointState(1, 3, "white", true),
        pointState(2, 1, "black"),
      ],
      [pointState(1, 2, "white"), pointState(2, 2)],
    ]);

    expect(calculateObjectiveScores(state)).toEqual({
      black: { secured: 1, advantage: 1, pieces: 9 },
      white: { secured: 1, advantage: 1, pieces: 10 },
    });
  });

  test("does not count Neutral or secured Objectives as Advantage", () => {
    const state = gameState([
      [
        pointState(3, 1, "black", true),
        pointState(1, 3, "white", true),
        pointState(2, 2),
      ],
    ]);

    expect(calculateObjectiveScores(state)).toEqual({
      black: { secured: 1, advantage: 0, pieces: 6 },
      white: { secured: 1, advantage: 0, pieces: 6 },
    });
  });

  test("counts pieces on unsecured and secured Objectives", () => {
    const state = gameState([
      [pointState(2, 1, "black"), pointState(1, 3, "white", true)],
    ]);

    expect(calculateObjectiveScores(state)).toEqual({
      black: { secured: 0, advantage: 1, pieces: 3 },
      white: { secured: 1, advantage: 0, pieces: 4 },
    });
  });

  test("derives Objective totals from mixed stack order", () => {
    const objective: PointState = {
      pieces: ["white", "black", "white", "black", "black"],
      secured: false,
      player: "black",
    };

    expect(calculateObjectiveScores(gameState([[objective]]))).toEqual({
      black: { secured: 0, advantage: 1, pieces: 3 },
      white: { secured: 0, advantage: 0, pieces: 2 },
    });
  });
});

describe("calculateGameResult", () => {
  test.each([
    {
      winner: "black",
      objectives: [
        [pointState(3, 0, "black", true), pointState(0, 2, "white")],
        [pointState(0, 2, "white"), pointState(0, 2, "white")],
      ],
    },
    {
      winner: "white",
      objectives: [
        [pointState(0, 3, "white", true), pointState(2, 0, "black")],
        [pointState(2, 0, "black"), pointState(2, 0, "black")],
      ],
    },
  ] as const)(
    "$winner wins on Secured Objectives despite worse lower-priority scores",
    ({ winner, objectives }) => {
      expect(calculateGameResult(gameState(objectives))).toMatchObject({
        finished: true,
        winner,
        reason: "secured-objectives",
      });
    },
  );

  test.each([
    {
      winner: "black",
      objectives: [
        [pointState(1, 0, "black"), pointState(0, 2, "white")],
        [
          pointState(1, 0, "black"),
          pointState(3, 2, "black", true),
          pointState(0, 3, "white", true),
        ],
      ],
    },
    {
      winner: "white",
      objectives: [
        [pointState(0, 1, "white"), pointState(2, 0, "black")],
        [
          pointState(0, 1, "white"),
          pointState(3, 0, "black", true),
          pointState(2, 3, "white", true),
        ],
      ],
    },
  ] as const)(
    "$winner wins on Advantage despite fewer Objective pieces",
    ({ winner, objectives }) => {
      const result = calculateGameResult(gameState(objectives));

      expect(result).toMatchObject({
        finished: true,
        winner,
        reason: "advantage-objectives",
      });

      if (!result.finished) {
        throw new Error("Expected a finished game result");
      }

      const opponent = winner === "black" ? "white" : "black";
      expect(result.scores[winner].pieces).toBeLessThan(
        result.scores[opponent].pieces,
      );
    },
  );

  test.each([
    {
      winner: "black",
      objectives: [[pointState(2, 1), pointState(1, 1)]],
    },
    {
      winner: "white",
      objectives: [[pointState(1, 2), pointState(1, 1)]],
    },
  ] as const)(
    "$winner wins on Objective pieces after higher-priority ties",
    ({ winner, objectives }) => {
      expect(calculateGameResult(gameState(objectives))).toMatchObject({
        finished: true,
        winner,
        reason: "objective-pieces",
      });
    },
  );

  test("returns a draw when every criterion is tied", () => {
    const result = calculateGameResult(
      gameState([
        [pointState(3, 1, "black", true), pointState(1, 3, "white", true)],
        [pointState(2, 1, "black"), pointState(1, 2, "white")],
      ]),
    );

    expect(result).toEqual({
      finished: true,
      winner: null,
      reason: "draw",
      scores: {
        black: { secured: 1, advantage: 1, pieces: 7 },
        white: { secured: 1, advantage: 1, pieces: 7 },
      },
    });
  });

  test("ignores all Supply Point state", () => {
    const objectives = [[pointState(2, 1, "black")]];
    const withoutSupplyPoints = gameState(objectives);
    const withVariedSupplyPoints = gameState(objectives, [
      [pointState(0, 3, "white", true), pointState(3, 0, "black", true)],
      [pointState(0, 2, "white"), pointState(2, 0, "black")],
    ]);

    expect(calculateGameResult(withVariedSupplyPoints)).toEqual(
      calculateGameResult(withoutSupplyPoints),
    );
  });

  test("returns no winner or final scores for an unfinished game", () => {
    const result = calculateGameResult(
      gameState([[pointState(3, 0, "black", true)]], [], false),
    );

    expect(result).toEqual({ finished: false });
    expect(result).not.toHaveProperty("winner");
    expect(result).not.toHaveProperty("scores");
  });

  test("does not mutate the input GameState", () => {
    const state = gameState(
      [[pointState(3, 1, "black", true), pointState(1, 2, "white")]],
      [[pointState(0, 3, "white", true)]],
    );
    const snapshot = structuredClone(state);

    calculateObjectiveScores(state);
    calculateGameResult(state);

    expect(state).toEqual(snapshot);
  });
});
