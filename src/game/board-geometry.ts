export interface SupplyPoint {
  readonly kind: "supply-point";
}

export interface Objective {
  readonly kind: "objective";
}

export interface BoardGeometry {
  readonly cellsPerSide: number;
  readonly supplyPoints: readonly (readonly SupplyPoint[])[];
  readonly objectives: readonly (readonly Objective[])[];
}

export function createBoardGeometry(cellsPerSide: number): BoardGeometry {
  if (!Number.isInteger(cellsPerSide) || cellsPerSide < 1) {
    throw new RangeError("Board size must be a positive integer");
  }

  const supplyPoints = Array.from({ length: cellsPerSide + 1 }, () =>
    Array.from(
      { length: cellsPerSide + 1 },
      (): SupplyPoint => ({
        kind: "supply-point",
      }),
    ),
  );

  const objectives = Array.from({ length: cellsPerSide }, () =>
    Array.from(
      { length: cellsPerSide },
      (): Objective => ({
        kind: "objective",
      }),
    ),
  );

  return {
    cellsPerSide,
    supplyPoints,
    objectives,
  };
}

export function getConnectedSupplyPoints(
  geometry: BoardGeometry,
  objectiveRow: number,
  objectiveColumn: number,
): readonly [SupplyPoint, SupplyPoint, SupplyPoint, SupplyPoint] {
  if (
    !Number.isInteger(objectiveRow) ||
    !Number.isInteger(objectiveColumn) ||
    objectiveRow < 0 ||
    objectiveColumn < 0 ||
    objectiveRow >= geometry.cellsPerSide ||
    objectiveColumn >= geometry.cellsPerSide
  ) {
    throw new RangeError("Objective coordinates must be within the board");
  }

  return [
    geometry.supplyPoints[objectiveRow][objectiveColumn],
    geometry.supplyPoints[objectiveRow][objectiveColumn + 1],
    geometry.supplyPoints[objectiveRow + 1][objectiveColumn],
    geometry.supplyPoints[objectiveRow + 1][objectiveColumn + 1],
  ];
}
