import type { BoardCoordinate } from "./board-geometry.ts";
import type {
  GameState,
  PlacementTarget,
  PointState,
} from "./game-state.ts";
import {
  evaluatePlacement,
  type PlacementIllegalReason,
} from "./placement-legality.ts";

export type PlacementApplicationIllegalReason =
  | PlacementIllegalReason
  | "supporting-supply-point-required"
  | "supporting-supply-point-not-eligible"
  | "unexpected-supporting-supply-point";

export type PlacementApplicationResult =
  | {
      readonly applied: true;
      readonly state: GameState;
    }
  | {
      readonly applied: false;
      readonly reason: PlacementApplicationIllegalReason;
    };

function coordinatesMatch(
  first: BoardCoordinate,
  second: BoardCoordinate,
): boolean {
  return first.row === second.row && first.column === second.column;
}

function appendActivePlayerPiece(
  point: PointState,
  activePlayer: GameState["turn"]["activePlayer"],
): PointState {
  return {
    ...point,
    pieces: [...point.pieces, activePlayer],
  };
}

export function applyPlacement(
  state: GameState,
  target: PlacementTarget,
  supportingSupplyPoint?: BoardCoordinate,
): PlacementApplicationResult {
  const legality = evaluatePlacement(state, target);

  if (!legality.legal) {
    return { applied: false, reason: legality.reason };
  }

  if (legality.kind === "supply-point") {
    if (supportingSupplyPoint !== undefined) {
      return {
        applied: false,
        reason: "unexpected-supporting-supply-point",
      };
    }
  } else {
    if (supportingSupplyPoint === undefined) {
      return {
        applied: false,
        reason: "supporting-supply-point-required",
      };
    }

    const selectedSupplyPointIsEligible =
      legality.eligibleSupplyPoints.some((eligibleSupplyPoint) =>
        coordinatesMatch(eligibleSupplyPoint, supportingSupplyPoint),
      );

    if (!selectedSupplyPointIsEligible) {
      return {
        applied: false,
        reason: "supporting-supply-point-not-eligible",
      };
    }
  }

  const { remainingPieces, turn } = state;
  const { activePlayer, placements, usedSupplyPoints } = turn;
  const matrixName =
    target.kind === "supply-point" ? "supplyPoints" : "objectives";
  const matrix = state[matrixName];
  const targetRow = matrix[target.row];
  const updatedRow = [...targetRow];

  updatedRow[target.column] = appendActivePlayerPiece(
    targetRow[target.column],
    activePlayer,
  );

  return {
    applied: true,
    state: {
      ...state,
      remainingPieces: {
        ...remainingPieces,
        [activePlayer]: remainingPieces[activePlayer] - 1,
      },
      [matrixName]: matrix.map((row, rowIndex) =>
        rowIndex === target.row ? updatedRow : row,
      ),
      turn: {
        ...turn,
        placements: [...placements, { ...target }],
        usedSupplyPoints: supportingSupplyPoint
          ? [...usedSupplyPoints, { ...supportingSupplyPoint }]
          : usedSupplyPoints,
      },
    },
  };
}
