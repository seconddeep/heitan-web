import { countPieces } from "./game-state.ts";
import type {
  GameState,
  PlacementTarget,
  PointState,
} from "./game-state.ts";

/**
 * Resolves the state shared by Supply Points and Objectives at turn completion.
 *
 * An unsecured 3-3 point is unreachable in legal play: only the active player
 * adds pieces during a turn, and a point is fixed as Secured as soon as either
 * player ends a turn with three pieces there.
 */
export function resolvePointState(point: PointState): PointState {
  if (point.secured) {
    return point;
  }

  const black = countPieces(point.pieces, "black");
  const white = countPieces(point.pieces, "white");

  if (black === 3 && white === 3) {
    throw new Error("Cannot resolve an unsecured point with a 3-3 piece count");
  }

  if (black === white) {
    return {
      pieces: point.pieces,
      secured: false,
      player: null,
    };
  }

  const secured = black === 3 || white === 3;
  const player = black > white ? "black" : "white";

  return {
    pieces: point.pieces,
    secured,
    player,
  };
}

function placementKey(target: PlacementTarget): string {
  return `${target.kind}:${target.row}:${target.column}`;
}

function resolveTargets(
  matrix: readonly (readonly PointState[])[],
  targets: readonly PlacementTarget[],
): readonly (readonly PointState[])[] {
  if (targets.length === 0) {
    return matrix;
  }

  const resolvedMatrix = matrix.map((row) => [...row]);

  for (const target of targets) {
    resolvedMatrix[target.row][target.column] = resolvePointState(
      matrix[target.row][target.column],
    );
  }

  return resolvedMatrix;
}

/** Resolves points changed by placements without completing the turn. */
export function resolvePointStates(state: GameState): GameState {
  const uniquePlacements = [
    ...new Map(
      state.turn.placements.map((target) => [placementKey(target), target]),
    ).values(),
  ];
  const supplyPointTargets = uniquePlacements.filter(
    (target) => target.kind === "supply-point",
  );
  const objectiveTargets = uniquePlacements.filter(
    (target) => target.kind === "objective",
  );

  return {
    ...state,
    supplyPoints: resolveTargets(state.supplyPoints, supplyPointTargets),
    objectives: resolveTargets(state.objectives, objectiveTargets),
  };
}
