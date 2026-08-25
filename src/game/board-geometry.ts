export interface BoardCoordinate {
  readonly row: number;
  readonly column: number;
}

export function validateBoardSize(cellsPerSide: number): void {
  if (!Number.isInteger(cellsPerSide) || cellsPerSide < 1) {
    throw new RangeError("Board size must be a positive integer");
  }
}

function createCoordinates(pointsPerSide: number): readonly BoardCoordinate[] {
  return Array.from({ length: pointsPerSide ** 2 }, (_, index) => ({
    row: Math.floor(index / pointsPerSide),
    column: index % pointsPerSide,
  }));
}

export function getSupplyPointCoordinates(
  cellsPerSide: number,
): readonly BoardCoordinate[] {
  validateBoardSize(cellsPerSide);

  return createCoordinates(cellsPerSide + 1);
}

export function getObjectiveCoordinates(
  cellsPerSide: number,
): readonly BoardCoordinate[] {
  validateBoardSize(cellsPerSide);

  return createCoordinates(cellsPerSide);
}

export function getConnectedSupplyPointCoordinates(
  cellsPerSide: number,
  objectiveRow: number,
  objectiveColumn: number,
): readonly [
  BoardCoordinate,
  BoardCoordinate,
  BoardCoordinate,
  BoardCoordinate,
] {
  validateBoardSize(cellsPerSide);

  if (
    !Number.isInteger(objectiveRow) ||
    !Number.isInteger(objectiveColumn) ||
    objectiveRow < 0 ||
    objectiveColumn < 0 ||
    objectiveRow >= cellsPerSide ||
    objectiveColumn >= cellsPerSide
  ) {
    throw new RangeError("Objective coordinates must be within the board");
  }

  return [
    { row: objectiveRow, column: objectiveColumn },
    { row: objectiveRow, column: objectiveColumn + 1 },
    { row: objectiveRow + 1, column: objectiveColumn },
    { row: objectiveRow + 1, column: objectiveColumn + 1 },
  ];
}
