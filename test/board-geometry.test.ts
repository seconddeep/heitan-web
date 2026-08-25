import { expect, test } from "vitest";

import {
  createBoardGeometry,
  getConnectedSupplyPoints,
} from "../src/game/board-geometry.ts";

test("creates a 5x5 Supply Point grid for a 4x4 board", () => {
  const geometry = createBoardGeometry(4);

  expect(geometry.supplyPoints).toHaveLength(5);
  for (const row of geometry.supplyPoints) {
    expect(row).toHaveLength(5);
  }
});

test("creates a 4x4 Objective grid for a 4x4 board", () => {
  const geometry = createBoardGeometry(4);

  expect(geometry.objectives).toHaveLength(4);
  for (const row of geometry.objectives) {
    expect(row).toHaveLength(4);
  }
});

test("creates row and column grids for multiple board sizes", () => {
  for (const cellsPerSide of [1, 3, 5]) {
    const geometry = createBoardGeometry(cellsPerSide);

    expect(geometry.supplyPoints).toHaveLength(cellsPerSide + 1);
    expect(geometry.supplyPoints[0]).toHaveLength(cellsPerSide + 1);
    expect(geometry.objectives).toHaveLength(cellsPerSide);
    expect(geometry.objectives[0]).toHaveLength(cellsPerSide);
  }
});

test("resolves the four Supply Points connected to Objective(0,0)", () => {
  const geometry = createBoardGeometry(4);
  const connected = getConnectedSupplyPoints(geometry, 0, 0);

  expect(connected[0]).toBe(geometry.supplyPoints[0][0]);
  expect(connected[1]).toBe(geometry.supplyPoints[0][1]);
  expect(connected[2]).toBe(geometry.supplyPoints[1][0]);
  expect(connected[3]).toBe(geometry.supplyPoints[1][1]);
});

test("resolves the four Supply Points connected to Objective(1,0)", () => {
  const geometry = createBoardGeometry(4);
  const connected = getConnectedSupplyPoints(geometry, 1, 0);

  expect(connected[0]).toBe(geometry.supplyPoints[1][0]);
  expect(connected[1]).toBe(geometry.supplyPoints[1][1]);
  expect(connected[2]).toBe(geometry.supplyPoints[2][0]);
  expect(connected[3]).toBe(geometry.supplyPoints[2][1]);
});

test("does not store point identifiers or Ludii vertex indices", () => {
  const geometry = createBoardGeometry(2);

  expect(geometry.supplyPoints[0][0]).toEqual({ kind: "supply-point" });
  expect(geometry.objectives[0][0]).toEqual({ kind: "objective" });
});

test("rejects Objective coordinates outside the board", () => {
  const geometry = createBoardGeometry(4);

  for (const coordinate of [
    [-1, 0],
    [0, -1],
    [4, 0],
    [0, 4],
    [0.5, 0],
  ]) {
    expect(() =>
      getConnectedSupplyPoints(geometry, coordinate[0], coordinate[1]),
    ).toThrow(new RangeError("Objective coordinates must be within the board"));
  }
});

test("rejects invalid board sizes", () => {
  for (const cellsPerSide of [0, -1, 1.5, Number.NaN]) {
    expect(() => createBoardGeometry(cellsPerSide)).toThrow(
      new RangeError("Board size must be a positive integer"),
    );
  }
});
