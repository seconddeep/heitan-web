import type { BoardGeometry } from "./game/board-geometry.ts";

export interface SvgPosition {
  readonly row: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
}

export interface SvgGridLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface BoardSvgLayout {
  readonly cellsPerSide: number;
  readonly gridLines: readonly SvgGridLine[];
  readonly supplyPoints: readonly SvgPosition[];
  readonly objectives: readonly SvgPosition[];
}

const svgNamespace = "http://www.w3.org/2000/svg";
const viewBoxPadding = 0.2;

export function createBoardSvgLayout(
  geometry: BoardGeometry,
): BoardSvgLayout {
  const gridLines = Array.from(
    { length: geometry.cellsPerSide + 1 },
    (_, coordinate): readonly [SvgGridLine, SvgGridLine] => [
      {
        x1: coordinate,
        y1: 0,
        x2: coordinate,
        y2: geometry.cellsPerSide,
      },
      {
        x1: 0,
        y1: coordinate,
        x2: geometry.cellsPerSide,
        y2: coordinate,
      },
    ],
  ).flat();

  const supplyPoints = geometry.supplyPoints.flatMap((row, rowIndex) =>
    row.map(
      (_, columnIndex): SvgPosition => ({
        row: rowIndex,
        column: columnIndex,
        x: columnIndex,
        y: rowIndex,
      }),
    ),
  );

  const objectives = geometry.objectives.flatMap((row, rowIndex) =>
    row.map(
      (_, columnIndex): SvgPosition => ({
        row: rowIndex,
        column: columnIndex,
        x: columnIndex + 0.5,
        y: rowIndex + 0.5,
      }),
    ),
  );

  return {
    cellsPerSide: geometry.cellsPerSide,
    gridLines,
    supplyPoints,
    objectives,
  };
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(svgNamespace, tagName);
}

function setCoordinates(
  element: SVGElement,
  position: SvgPosition,
): void {
  element.dataset.row = String(position.row);
  element.dataset.column = String(position.column);
}

export function renderBoard(geometry: BoardGeometry): SVGSVGElement {
  const layout = createBoardSvgLayout(geometry);
  const svg = createSvgElement("svg");
  const viewBoxSize = layout.cellsPerSide + viewBoxPadding * 2;

  svg.classList.add("heitan-board");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Heitan board with ${layout.cellsPerSide} rows and ${layout.cellsPerSide} columns`,
  );
  svg.setAttribute(
    "viewBox",
    `${-viewBoxPadding} ${-viewBoxPadding} ${viewBoxSize} ${viewBoxSize}`,
  );

  const grid = createSvgElement("g");
  grid.classList.add("board-grid");

  for (const gridLine of layout.gridLines) {
    const line = createSvgElement("line");
    line.setAttribute("x1", String(gridLine.x1));
    line.setAttribute("y1", String(gridLine.y1));
    line.setAttribute("x2", String(gridLine.x2));
    line.setAttribute("y2", String(gridLine.y2));
    grid.append(line);
  }

  svg.append(grid);

  for (const position of layout.objectives) {
    const objective = createSvgElement("circle");
    objective.classList.add("objective");
    objective.setAttribute("cx", String(position.x));
    objective.setAttribute("cy", String(position.y));
    objective.setAttribute("r", "0.09");
    setCoordinates(objective, position);
    svg.append(objective);
  }

  for (const position of layout.supplyPoints) {
    const supplyPoint = createSvgElement("circle");
    supplyPoint.classList.add("supply-point");
    supplyPoint.setAttribute("cx", String(position.x));
    supplyPoint.setAttribute("cy", String(position.y));
    supplyPoint.setAttribute("r", "0.09");
    setCoordinates(supplyPoint, position);
    svg.append(supplyPoint);
  }

  return svg;
}
