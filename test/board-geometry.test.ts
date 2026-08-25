import { expect, test } from "vitest";

import {
  getConnectedSupplyPointCoordinates,
  getObjectiveCoordinates,
  getSupplyPointCoordinates,
  validateBoardSize,
} from "../src/game/board-geometry.ts";

test("derives 5x5 Supply Point coordinates for a 4x4 board", () => {
  const coordinates = getSupplyPointCoordinates(4);

  expect(coordinates).toHaveLength(25);
  for (const row of [0, 1, 2, 3, 4]) {
    expect(
      coordinates.filter((coordinate) => coordinate.row === row),
    ).toHaveLength(5);
  }
});

test("derives 4x4 Objective coordinates for a 4x4 board", () => {
  const coordinates = getObjectiveCoordinates(4);

  expect(coordinates).toHaveLength(16);
  for (const row of [0, 1, 2, 3]) {
    expect(
      coordinates.filter((coordinate) => coordinate.row === row),
    ).toHaveLength(4);
  }
});

test("derives row and column coordinates for multiple board sizes", () => {
  for (const cellsPerSide of [1, 3, 5]) {
    const supplyPoints = getSupplyPointCoordinates(cellsPerSide);
    const objectives = getObjectiveCoordinates(cellsPerSide);

    expect(supplyPoints).toHaveLength((cellsPerSide + 1) ** 2);
    expect(supplyPoints.at(-1)).toEqual({
      row: cellsPerSide,
      column: cellsPerSide,
    });
    expect(objectives).toHaveLength(cellsPerSide ** 2);
    expect(objectives.at(-1)).toEqual({
      row: cellsPerSide - 1,
      column: cellsPerSide - 1,
    });
  }
});

test("derives the four Supply Points connected to Objective(0,0)", () => {
  const connected = getConnectedSupplyPointCoordinates(4, 0, 0);

  expect(connected).toEqual([
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
  ]);
  expect(connected).toHaveLength(4);
});

test("derives the four Supply Points connected to Objective(1,0)", () => {
  const connected = getConnectedSupplyPointCoordinates(4, 1, 0);

  expect(connected).toEqual([
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 2, column: 0 },
    { row: 2, column: 1 },
  ]);
  expect(connected).toHaveLength(4);
});

test("rejects Objective coordinates outside the board", () => {
  for (const coordinate of [
    [-1, 0],
    [0, -1],
    [4, 0],
    [0, 4],
    [0.5, 0],
    [0, 0.5],
  ]) {
    expect(() =>
      getConnectedSupplyPointCoordinates(4, coordinate[0], coordinate[1]),
    ).toThrow(new RangeError("Objective coordinates must be within the board"));
  }
});

test("rejects invalid board sizes", () => {
  for (const cellsPerSide of [0, -1, 1.5, Number.NaN]) {
    expect(() => validateBoardSize(cellsPerSide)).toThrow(
      new RangeError("Board size must be a positive integer"),
    );
    expect(() => getSupplyPointCoordinates(cellsPerSide)).toThrow(RangeError);
    expect(() => getObjectiveCoordinates(cellsPerSide)).toThrow(RangeError);
    expect(() =>
      getConnectedSupplyPointCoordinates(cellsPerSide, 0, 0),
    ).toThrow(RangeError);
  }
});
