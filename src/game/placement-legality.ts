import { getConnectedSupplyPointCoordinates } from "./board-geometry.ts";
import type { BoardCoordinate } from "./board-geometry.ts";
import type {
  GameState,
  PlacementTarget,
  PointState,
} from "./game-state.ts";
import { countPieces } from "./game-state.ts";

type CommonPlacementIllegalReason =
  | "invalid-target"
  | "no-remaining-pieces"
  | "turn-placement-limit-reached"
  | "point-secured"
  | "player-point-limit-reached";

export type SupplyPointPlacementIllegalReason =
  | CommonPlacementIllegalReason
  | "supply-point-turn-limit-reached";

export type ObjectivePlacementIllegalReason =
  | CommonPlacementIllegalReason
  | "no-eligible-supply-point";

export type PlacementIllegalReason =
  | SupplyPointPlacementIllegalReason
  | ObjectivePlacementIllegalReason;

type IllegalPlacementResult<Reason extends PlacementIllegalReason> = {
  readonly legal: false;
  readonly reason: Reason;
};

export type SupplyPointPlacementLegalityResult =
  | { readonly legal: true }
  | IllegalPlacementResult<SupplyPointPlacementIllegalReason>;

export type ObjectivePlacementLegalityResult =
  | {
      readonly legal: true;
      readonly eligibleSupplyPoints: readonly BoardCoordinate[];
    }
  | IllegalPlacementResult<ObjectivePlacementIllegalReason>;

export type PlacementLegalityResult =
  | {
      readonly legal: true;
      readonly kind: "supply-point";
    }
  | {
      readonly legal: true;
      readonly kind: "objective";
      readonly eligibleSupplyPoints: readonly BoardCoordinate[];
    }
  | {
      readonly legal: false;
      readonly reason: PlacementIllegalReason;
    };

function getTargetPoint(
  points: readonly (readonly PointState[])[],
  target: BoardCoordinate,
): PointState | undefined {
  if (
    !Number.isInteger(target.row) ||
    !Number.isInteger(target.column) ||
    target.row < 0 ||
    target.column < 0
  ) {
    return undefined;
  }

  return points[target.row]?.[target.column];
}

function coordinatesMatch(
  first: BoardCoordinate,
  second: BoardCoordinate,
): boolean {
  return first.row === second.row && first.column === second.column;
}

function evaluateCommonPlacement(
  state: GameState,
  targetPoint: PointState | undefined,
): IllegalPlacementResult<CommonPlacementIllegalReason> | null {
  if (targetPoint === undefined) {
    return { legal: false, reason: "invalid-target" };
  }

  const activePlayer = state.turn.activePlayer;

  if (state.remainingPieces[activePlayer] <= 0) {
    return { legal: false, reason: "no-remaining-pieces" };
  }

  if (state.turn.placements.length >= 3) {
    return { legal: false, reason: "turn-placement-limit-reached" };
  }

  if (targetPoint.secured) {
    return { legal: false, reason: "point-secured" };
  }

  if (countPieces(targetPoint.pieces, activePlayer) >= 3) {
    return { legal: false, reason: "player-point-limit-reached" };
  }

  return null;
}

export function evaluateSupplyPointPlacement(
  state: GameState,
  coordinate: BoardCoordinate,
): SupplyPointPlacementLegalityResult {
  const commonResult = evaluateCommonPlacement(
    state,
    getTargetPoint(state.supplyPoints, coordinate),
  );

  if (commonResult !== null) {
    return commonResult;
  }

  const placementsOnTarget = state.turn.placements.filter(
    (placement) =>
      placement.kind === "supply-point" &&
      coordinatesMatch(placement, coordinate),
  ).length;

  if (placementsOnTarget >= 2) {
    return {
      legal: false,
      reason: "supply-point-turn-limit-reached",
    };
  }

  return { legal: true };
}

export function evaluateObjectivePlacement(
  state: GameState,
  coordinate: BoardCoordinate,
): ObjectivePlacementLegalityResult {
  const commonResult = evaluateCommonPlacement(
    state,
    getTargetPoint(state.objectives, coordinate),
  );

  if (commonResult !== null) {
    return commonResult;
  }

  const activePlayer = state.turn.activePlayer;
  const eligibleSupplyPoints = getConnectedSupplyPointCoordinates(
    state.objectives.length,
    coordinate.row,
    coordinate.column,
  ).filter((coordinate) => {
    const supplyPoint = state.supplyPoints[coordinate.row][coordinate.column];
    const alreadyUsed = state.turn.usedSupplyPoints.some((usedCoordinate) =>
      coordinatesMatch(usedCoordinate, coordinate),
    );

    return supplyPoint.player === activePlayer && !alreadyUsed;
  });

  if (eligibleSupplyPoints.length === 0) {
    return { legal: false, reason: "no-eligible-supply-point" };
  }

  return {
    legal: true,
    eligibleSupplyPoints,
  };
}

export function evaluatePlacement(
  state: GameState,
  target: PlacementTarget,
): PlacementLegalityResult {
  if (target.kind === "supply-point") {
    const result = evaluateSupplyPointPlacement(state, target);

    return result.legal ? { legal: true, kind: "supply-point" } : result;
  }

  const result = evaluateObjectivePlacement(state, target);

  return result.legal
    ? {
        legal: true,
        kind: "objective",
        eligibleSupplyPoints: result.eligibleSupplyPoints,
      }
    : result;
}
