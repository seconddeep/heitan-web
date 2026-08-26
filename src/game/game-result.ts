import { isGameOver } from "./game-end.ts";
import type { GameState, Player } from "./game-state.ts";

export interface ObjectiveScore {
  readonly secured: number;
  readonly advantage: number;
  readonly pieces: number;
}

export interface ObjectiveScores {
  readonly black: ObjectiveScore;
  readonly white: ObjectiveScore;
}

export type GameResult =
  | {
      readonly finished: false;
    }
  | {
      readonly finished: true;
      readonly winner: Player;
      readonly reason:
        | "secured-objectives"
        | "advantage-objectives"
        | "objective-pieces";
      readonly scores: ObjectiveScores;
    }
  | {
      readonly finished: true;
      readonly winner: null;
      readonly reason: "draw";
      readonly scores: ObjectiveScores;
    };

/** Calculates each player's score from Objectives only. */
export function calculateObjectiveScores(state: GameState): ObjectiveScores {
  let blackSecured = 0;
  let blackAdvantage = 0;
  let blackPieces = 0;
  let whiteSecured = 0;
  let whiteAdvantage = 0;
  let whitePieces = 0;

  for (const row of state.objectives) {
    for (const objective of row) {
      blackPieces += objective.pieces.black;
      whitePieces += objective.pieces.white;

      if (objective.player === "black") {
        if (objective.secured) {
          blackSecured += 1;
        } else {
          blackAdvantage += 1;
        }
      } else if (objective.player === "white") {
        if (objective.secured) {
          whiteSecured += 1;
        } else {
          whiteAdvantage += 1;
        }
      }
    }
  }

  return {
    black: {
      secured: blackSecured,
      advantage: blackAdvantage,
      pieces: blackPieces,
    },
    white: {
      secured: whiteSecured,
      advantage: whiteAdvantage,
      pieces: whitePieces,
    },
  };
}

/** Calculates the final result, or reports that the game is unfinished. */
export function calculateGameResult(state: GameState): GameResult {
  if (!isGameOver(state)) {
    return { finished: false };
  }

  const scores = calculateObjectiveScores(state);
  const { black, white } = scores;
  const comparisons = [
    {
      black: black.secured,
      white: white.secured,
      reason: "secured-objectives" as const,
    },
    {
      black: black.advantage,
      white: white.advantage,
      reason: "advantage-objectives" as const,
    },
    {
      black: black.pieces,
      white: white.pieces,
      reason: "objective-pieces" as const,
    },
  ];

  for (const { black, white, reason } of comparisons) {
    if (black !== white) {
      const winner = black > white ? "black" : "white";
      return {
        finished: true,
        winner,
        reason,
        scores,
      };
    }
  }

  return {
    finished: true,
    winner: null,
    reason: "draw",
    scores,
  };
}
