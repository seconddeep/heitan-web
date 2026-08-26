import { getConnectedSupplyPointCoordinates } from "./board-geometry.ts";
import type { BoardCoordinate } from "./board-geometry.ts";
import type {
  GameState,
  PlacementTarget,
  PointState,
} from "./game-state.ts";
import { countPieces } from "./game-state.ts";

export type PlacementIllegalReason =
  | "invalid-target"
  | "no-remaining-pieces"
  | "turn-placement-limit-reached"
  | "point-secured"
  | "player-point-limit-reached"
  | "supply-point-turn-limit-reached"
  | "no-eligible-supply-point";

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
  state: GameState,
  target: PlacementTarget,
): PointState | undefined {
  if (
    !Number.isInteger(target.row) ||
    !Number.isInteger(target.column) ||
    target.row < 0 ||
    target.column < 0
  ) {
    return undefined;
  }

  const points =
    target.kind === "supply-point"
      ? state.supplyPoints
      : state.objectives;

  return points[target.row]?.[target.column];
}

function coordinatesMatch(
  first: BoardCoordinate,
  second: BoardCoordinate,
): boolean {
  return first.row === second.row && first.column === second.column;
}

export function evaluatePlacement(
  state: GameState,
  target: PlacementTarget,
): PlacementLegalityResult {
  const targetPoint = getTargetPoint(state, target);

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

  if (target.kind === "supply-point") {
    const placementsOnTarget = state.turn.placements.filter(
      (placement) =>
        placement.kind === "supply-point" &&
        coordinatesMatch(placement, target),
    ).length;

    if (placementsOnTarget >= 2) {
      return {
        legal: false,
        reason: "supply-point-turn-limit-reached",
      };
    }

    return { legal: true, kind: "supply-point" };
  }

  const eligibleSupplyPoints = getConnectedSupplyPointCoordinates(
    state.objectives.length,
    target.row,
    target.column,
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
    kind: "objective",
    eligibleSupplyPoints,
  };
}
