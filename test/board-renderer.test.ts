// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";

import {
  createBoardSvgLayout,
  renderBoard,
} from "../src/board-renderer.ts";

describe.each([4, 7])("%i×%i board SVG layout", (cellsPerSide) => {
  const layout = createBoardSvgLayout(cellsPerSide);

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

describe.each([4, 7])("%i×%i rendered board", (cellsPerSide) => {
  const svg = renderBoard(cellsPerSide);
  const supplyPointMarkers = Array.from(
    svg.querySelectorAll<SVGCircleElement>(".supply-point"),
  );
  const supplyPointTargets = Array.from(
    svg.querySelectorAll<SVGCircleElement>(".supply-point-target"),
  );
  const objectiveTargets = Array.from(
    svg.querySelectorAll<SVGRectElement>(".objective-target"),
  );

  test("renders separate markers and interaction targets", () => {
    expect(supplyPointMarkers).toHaveLength((cellsPerSide + 1) ** 2);
    expect(supplyPointTargets).toHaveLength((cellsPerSide + 1) ** 2);
    expect(objectiveTargets).toHaveLength(cellsPerSide ** 2);
    expect(svg.querySelector(".objective")).toBeNull();

    expect(supplyPointMarkers.every((element) => element.tagName === "circle"))
      .toBe(true);
    expect(supplyPointTargets.every((element) => element.tagName === "circle"))
      .toBe(true);
    expect(objectiveTargets.every((element) => element.tagName === "rect"))
      .toBe(true);
  });

  test("maps targets to zero-based board coordinates", () => {
    for (const [index, target] of supplyPointTargets.entries()) {
      const row = Math.floor(index / (cellsPerSide + 1));
      const column = index % (cellsPerSide + 1);

      expect(target.dataset).toMatchObject({
        kind: "supply-point",
        row: String(row),
        column: String(column),
      });
    }

    for (const [index, target] of objectiveTargets.entries()) {
      const row = Math.floor(index / cellsPerSide);
      const column = index % cellsPerSide;

      expect(target.dataset).toMatchObject({
        kind: "objective",
        row: String(row),
        column: String(column),
      });
      expect(target.getAttribute("x")).toBe(String(column));
      expect(target.getAttribute("y")).toBe(String(row));
      expect(target.getAttribute("width")).toBe("1");
      expect(target.getAttribute("height")).toBe("1");
    }
  });

  test("orders decoration below interaction targets", () => {
    const children = Array.from(svg.children);
    const gridIndex = children.indexOf(svg.querySelector(".board-grid")!);
    const firstMarkerIndex = Math.min(
      ...supplyPointMarkers.map((marker) => children.indexOf(marker)),
    );
    const lastMarkerIndex = Math.max(
      ...supplyPointMarkers.map((marker) => children.indexOf(marker)),
    );
    const firstObjectiveIndex = Math.min(
      ...objectiveTargets.map((target) => children.indexOf(target)),
    );
    const lastObjectiveIndex = Math.max(
      ...objectiveTargets.map((target) => children.indexOf(target)),
    );
    const firstSupplyPointIndex = Math.min(
      ...supplyPointTargets.map((target) => children.indexOf(target)),
    );

    expect(gridIndex).toBeLessThan(firstMarkerIndex);
    expect(lastMarkerIndex).toBeLessThan(firstObjectiveIndex);
    expect(lastObjectiveIndex).toBeLessThan(firstSupplyPointIndex);
  });

  test("contains every Supply Point hit target within the viewBox", () => {
    const viewBox = svg.viewBox.baseVal;
    const maximumX = viewBox.x + viewBox.width;
    const maximumY = viewBox.y + viewBox.height;

    for (const target of supplyPointTargets) {
      const x = Number(target.getAttribute("cx"));
      const y = Number(target.getAttribute("cy"));
      const hitRadius = Number(target.getAttribute("r"));

      expect(x - hitRadius).toBeGreaterThanOrEqual(viewBox.x);
      expect(x + hitRadius).toBeLessThanOrEqual(maximumX);
      expect(y - hitRadius).toBeGreaterThanOrEqual(viewBox.y);
      expect(y + hitRadius).toBeLessThanOrEqual(maximumY);
    }
  });
});
