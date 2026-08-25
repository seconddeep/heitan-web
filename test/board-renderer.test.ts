import { describe, expect, test } from "vitest";

import { createBoardSvgLayout } from "../src/board-renderer.ts";
import { createBoardGeometry } from "../src/game/board-geometry.ts";

describe.each([4, 7])("%i×%i board SVG layout", (cellsPerSide) => {
  const layout = createBoardSvgLayout(createBoardGeometry(cellsPerSide));

  test("creates horizontal and vertical grid lines", () => {
    expect(layout.gridLines).toHaveLength((cellsPerSide + 1) * 2);
  });

  test("creates the expected number of Supply Points and Objectives", () => {
    expect(layout.supplyPoints).toHaveLength((cellsPerSide + 1) ** 2);
    expect(layout.objectives).toHaveLength(cellsPerSide ** 2);
  });

  test("places Supply Points at all four grid corners", () => {
    expect(layout.supplyPoints).toEqual(
      expect.arrayContaining([
        { row: 0, column: 0, x: 0, y: 0 },
        {
          row: 0,
          column: cellsPerSide,
          x: cellsPerSide,
          y: 0,
        },
        {
          row: cellsPerSide,
          column: 0,
          x: 0,
          y: cellsPerSide,
        },
        {
          row: cellsPerSide,
          column: cellsPerSide,
          x: cellsPerSide,
          y: cellsPerSide,
        },
      ]),
    );
  });

  test("places the first and last Objectives at cell centers", () => {
    expect(layout.objectives[0]).toEqual({
      row: 0,
      column: 0,
      x: 0.5,
      y: 0.5,
    });
    expect(layout.objectives.at(-1)).toEqual({
      row: cellsPerSide - 1,
      column: cellsPerSide - 1,
      x: cellsPerSide - 0.5,
      y: cellsPerSide - 0.5,
    });
  });
});
