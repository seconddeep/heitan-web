import {
  getObjectiveCoordinates,
  getSupplyPointCoordinates,
  validateBoardSize,
} from "./game/board-geometry.ts";

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
const supplyPointMarkerRadius = 0.09;
const supplyPointHitRadius = 0.3;
const viewBoxPadding = 0.35;

export function createBoardSvgLayout(cellsPerSide: number): BoardSvgLayout {
  validateBoardSize(cellsPerSide);

  const gridLines = Array.from(
    { length: cellsPerSide + 1 },
    (_, coordinate): readonly [SvgGridLine, SvgGridLine] => [
      {
        x1: coordinate,
        y1: 0,
        x2: coordinate,
        y2: cellsPerSide,
      },
      {
        x1: 0,
        y1: coordinate,
        x2: cellsPerSide,
        y2: coordinate,
      },
    ],
  ).flat();

  const supplyPoints = getSupplyPointCoordinates(cellsPerSide).map(
    ({ row, column }): SvgPosition => ({
      row,
      column,
      x: column,
      y: row,
    }),
  );

  const objectives = getObjectiveCoordinates(cellsPerSide).map(
    ({ row, column }): SvgPosition => ({
      row,
      column,
      x: column + 0.5,
      y: row + 0.5,
    }),
  );

  return {
    cellsPerSide,
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

function setTargetMetadata(
  element: SVGElement,
  position: SvgPosition,
  kind: "supply-point" | "objective",
): void {
  element.dataset.kind = kind;
  element.dataset.row = String(position.row);
  element.dataset.column = String(position.column);
}

export function renderBoard(cellsPerSide: number): SVGSVGElement {
  const layout = createBoardSvgLayout(cellsPerSide);
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
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

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

  for (const position of layout.supplyPoints) {
    const supplyPoint = createSvgElement("circle");
    supplyPoint.classList.add("supply-point");
    supplyPoint.setAttribute("cx", String(position.x));
    supplyPoint.setAttribute("cy", String(position.y));
    supplyPoint.setAttribute("r", String(supplyPointMarkerRadius));
    svg.append(supplyPoint);
  }

  for (const position of layout.objectives) {
    const target = createSvgElement("rect");
    target.classList.add("objective-target");
    target.setAttribute("x", String(position.x - 0.5));
    target.setAttribute("y", String(position.y - 0.5));
    target.setAttribute("width", "1");
    target.setAttribute("height", "1");
    setTargetMetadata(target, position, "objective");
    svg.append(target);
  }

  for (const position of layout.supplyPoints) {
    const target = createSvgElement("circle");
    target.classList.add("supply-point-target");
    target.setAttribute("cx", String(position.x));
    target.setAttribute("cy", String(position.y));
    target.setAttribute("r", String(supplyPointHitRadius));
    setTargetMetadata(target, position, "supply-point");
    svg.append(target);
  }

  return svg;
}
