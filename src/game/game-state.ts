import {
  validateBoardSize,
  type BoardCoordinate,
} from "./board-geometry.ts";

export type Player = "black" | "white";

/**
 * The board point that receives one piece during the current turn.
 * Coordinates follow the shared zero-based row/column convention.
 */
export interface PlacementTarget extends BoardCoordinate {
  readonly kind: "supply-point" | "objective";
}

export interface PieceCounts {
  readonly black: number;
  readonly white: number;
}

/**
 * State for one board point. Piece counts include placements already made
 * during the current turn, while player and secured remain unchanged until the
 * turn is completed.
 *
 * For an unsecured Supply Point, player is the controlling player. For an
 * unsecured Objective, player is the player with Advantage. For a Secured
 * point, player is the player who Secured it. Null represents Neutral.
 */
export type PointState =
  | {
      readonly pieces: PieceCounts;
      readonly secured: false;
      readonly player: Player | null;
    }
  | {
      readonly pieces: PieceCounts;
      readonly secured: true;
      readonly player: Player;
    };

/**
 * State recorded during a turn, without applying placement or turn rules.
 * Range, uniqueness, usage, completion, and reset behavior belong to later
 * game-rule logic.
 */
export interface TurnState {
  readonly activePlayer: Player;
  readonly placements: readonly PlacementTarget[];
  /**
   * Supply Points consumed to support Objective placements this turn. This is
   * distinct from Supply Points that appear as targets in placements.
   */
  readonly usedSupplyPoints: readonly BoardCoordinate[];
}

/**
 * Changing game state, kept separate from immutable board structure.
 *
 * State locations use the BoardCoordinate convention: rows and columns are
 * zero-based, rows increase from top to bottom, and columns increase from left
 * to right. A coordinate maps to `supplyPoints[row][column]` or
 * `objectives[row][column]` according to the containing collection.
 */
export interface GameState {
  readonly remainingPieces: PieceCounts;
  readonly supplyPoints: readonly (readonly PointState[])[];
  readonly objectives: readonly (readonly PointState[])[];
  readonly turn: TurnState;
}

function createInitialPointState(): PointState {
  return {
    pieces: {
      black: 0,
      white: 0,
    },
    secured: false,
    player: null,
  };
}

function createPointStateMatrix(
  pointsPerSide: number,
): readonly (readonly PointState[])[] {
  return Array.from({ length: pointsPerSide }, () =>
    Array.from({ length: pointsPerSide }, () => createInitialPointState()),
  );
}

export function createInitialGameState(
  cellsPerSide: number,
  piecesPerPlayer: number,
): GameState {
  validateBoardSize(cellsPerSide);

  if (!Number.isSafeInteger(piecesPerPlayer) || piecesPerPlayer <= 0) {
    throw new RangeError("Pieces per player must be a positive safe integer");
  }

  return {
    remainingPieces: {
      black: piecesPerPlayer,
      white: piecesPerPlayer,
    },
    supplyPoints: createPointStateMatrix(cellsPerSide + 1),
    objectives: createPointStateMatrix(cellsPerSide),
    turn: {
      activePlayer: "black",
      placements: [],
      usedSupplyPoints: [],
    },
  };
}
