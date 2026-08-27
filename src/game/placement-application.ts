import type { BoardCoordinate } from "./board-geometry.ts";
import type {
  GameState,
  PlacementTarget,
  PointState,
} from "./game-state.ts";

function appendActivePlayerPiece(
  point: PointState,
  activePlayer: GameState["turn"]["activePlayer"],
): PointState {
  return {
    ...point,
    pieces: [...point.pieces, activePlayer],
  };
}

function updatePointMatrix(
  matrix: readonly (readonly PointState[])[],
  coordinate: BoardCoordinate,
  activePlayer: GameState["turn"]["activePlayer"],
): readonly (readonly PointState[])[] {
  const targetRow = matrix[coordinate.row];
  const updatedRow = [...targetRow];

  updatedRow[coordinate.column] = appendActivePlayerPiece(
    targetRow[coordinate.column],
    activePlayer,
  );

  return matrix.map((row, rowIndex) =>
    rowIndex === coordinate.row ? updatedRow : row,
  );
}

function recordPlacement(
  state: GameState,
  placement: PlacementTarget,
  usedSupplyPoints: GameState["turn"]["usedSupplyPoints"],
): Pick<GameState, "remainingPieces" | "turn"> {
  const { activePlayer } = state.turn;

  return {
    remainingPieces: {
      ...state.remainingPieces,
      [activePlayer]: state.remainingPieces[activePlayer] - 1,
    },
    turn: {
      ...state.turn,
      placements: [...state.turn.placements, placement],
      usedSupplyPoints,
    },
  };
}

export function applySupplyPointPlacement(
  state: GameState,
  coordinate: BoardCoordinate,
): GameState {
  const placement = { kind: "supply-point", ...coordinate } as const;

  return {
    ...state,
    supplyPoints: updatePointMatrix(
      state.supplyPoints,
      coordinate,
      state.turn.activePlayer,
    ),
    ...recordPlacement(state, placement, state.turn.usedSupplyPoints),
  };
}

export function applyObjectivePlacement(
  state: GameState,
  coordinate: BoardCoordinate,
  supportingSupplyPoint: BoardCoordinate,
): GameState {
  const placement = { kind: "objective", ...coordinate } as const;

  return {
    ...state,
    objectives: updatePointMatrix(
      state.objectives,
      coordinate,
      state.turn.activePlayer,
    ),
    ...recordPlacement(state, placement, [
      ...state.turn.usedSupplyPoints,
      { ...supportingSupplyPoint },
    ]),
  };
}
