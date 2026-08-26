import {
  getObjectiveCoordinates,
  getSupplyPointCoordinates,
  type BoardCoordinate,
  validateBoardSize,
} from "./game/board-geometry.ts";
import { countPieces } from "./game/game-state.ts";
import type { GameState, Player, PointState } from "./game/game-state.ts";

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

export interface BoardPresentationState {
  readonly eligibleSupplyPoints?: readonly BoardCoordinate[];
}

const svgNamespace = "http://www.w3.org/2000/svg";
const supplyPointMarkerRadius = 0.09;
const supplyPointHitRadius = 0.3;
const pieceRadius = 0.24;
const pieceStackStep = 0.1;
// A legal point can hold five pieces (3 for one player and 2 for the other).
// The padding contains a row-0 stack plus a small allowance for its stroke.
const viewBoxPadding = 0.66;
const placementsPerTurn = 3;

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

function setCoordinateMetadata(
  element: SVGElement,
  position: SvgPosition,
  kind: "supply-point" | "objective",
): void {
  element.dataset.kind = kind;
  element.dataset.row = String(position.row);
  element.dataset.column = String(position.column);
}

function getPointState(
  state: GameState,
  position: SvgPosition,
  kind: "supply-point" | "objective",
): PointState {
  return kind === "supply-point"
    ? state.supplyPoints[position.row][position.column]
    : state.objectives[position.row][position.column];
}

function appendPointPieces(
  layer: SVGGElement,
  position: SvgPosition,
  kind: "supply-point" | "objective",
  point: PointState,
): void {
  const totalPieceCount = point.pieces.length;

  if (totalPieceCount === 0) {
    return;
  }

  const blackPieceCount = countPieces(point.pieces, "black");
  const whitePieceCount = countPieces(point.pieces, "white");
  const stack = createSvgElement("g");
  stack.classList.add("piece-stack");
  stack.dataset.count = String(totalPieceCount);
  stack.dataset.blackCount = String(blackPieceCount);
  stack.dataset.whiteCount = String(whitePieceCount);
  stack.setAttribute(
    "aria-label",
    `${blackPieceCount} black pieces and ${whitePieceCount} white pieces`,
  );
  setCoordinateMetadata(stack, position, kind);

  // Draw from the bottom upward. Later SVG children paint on top, so each
  // upper disc overlaps the disc immediately below it, matching a physical
  // stack viewed from above.
  for (const [stackIndex, player] of point.pieces.entries()) {
    const piece = createSvgElement("circle");
    piece.classList.add("piece", `${player}-piece`);
    piece.setAttribute("cx", String(position.x));
    piece.setAttribute(
      "cy",
      String(position.y - stackIndex * pieceStackStep),
    );
    piece.setAttribute("r", String(pieceRadius));
    piece.dataset.player = player;
    piece.dataset.stackIndex = String(stackIndex);
    stack.append(piece);
  }

  layer.append(stack);
}

function validateStateDimensions(state: GameState): number {
  const cellsPerSide = state.objectives.length;
  validateBoardSize(cellsPerSide);

  const hasSquareObjectives = state.objectives.every(
    (row) => row.length === cellsPerSide,
  );
  const expectedSupplyPointsPerSide = cellsPerSide + 1;
  const hasSquareSupplyPoints =
    state.supplyPoints.length === expectedSupplyPointsPerSide &&
    state.supplyPoints.every(
      (row) => row.length === expectedSupplyPointsPerSide,
    );

  if (!hasSquareObjectives || !hasSquareSupplyPoints) {
    throw new RangeError("GameState board matrices must match the board size");
  }

  return cellsPerSide;
}

function coordinatesMatch(
  first: BoardCoordinate,
  second: BoardCoordinate,
): boolean {
  return first.row === second.row && first.column === second.column;
}

/** Renders a fresh SVG projection of GameState plus transient presentation. */
export function renderBoard(
  state: GameState,
  presentation: BoardPresentationState = {},
): SVGSVGElement {
  const cellsPerSide = validateStateDimensions(state);
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

  const markerLayer = createSvgElement("g");
  markerLayer.classList.add("supply-point-marker-layer");
  const pieceLayer = createSvgElement("g");
  pieceLayer.classList.add("piece-layer");
  const targetLayer = createSvgElement("g");
  targetLayer.classList.add("hit-target-layer");

  for (const position of layout.supplyPoints) {
    const point = getPointState(state, position, "supply-point");

    const marker = createSvgElement("circle");
    marker.classList.add("supply-point");
    marker.setAttribute("cx", String(position.x));
    marker.setAttribute("cy", String(position.y));
    marker.setAttribute("r", String(supplyPointMarkerRadius));
    markerLayer.append(marker);

    appendPointPieces(
      pieceLayer,
      position,
      "supply-point",
      point,
    );
  }

  for (const position of layout.objectives) {
    const point = getPointState(state, position, "objective");
    appendPointPieces(pieceLayer, position, "objective", point);

    const target = createSvgElement("rect");
    target.classList.add("objective-target");
    target.setAttribute("x", String(position.x - 0.5));
    target.setAttribute("y", String(position.y - 0.5));
    target.setAttribute("width", "1");
    target.setAttribute("height", "1");
    setCoordinateMetadata(target, position, "objective");
    targetLayer.append(target);
  }

  for (const position of layout.supplyPoints) {
    const target = createSvgElement("circle");
    target.classList.add("supply-point-target");
    target.setAttribute("cx", String(position.x));
    target.setAttribute("cy", String(position.y));
    target.setAttribute("r", String(supplyPointHitRadius));
    setCoordinateMetadata(target, position, "supply-point");

    if (
      presentation.eligibleSupplyPoints?.some((coordinate) =>
        coordinatesMatch(coordinate, position),
      )
    ) {
      target.classList.add("eligible-support");
      target.dataset.supportEligible = "true";
    }

    targetLayer.append(target);
  }

  svg.append(grid, markerLayer, pieceLayer, targetLayer);

  return svg;
}

function capitalize(player: Player): string {
  return `${player[0].toUpperCase()}${player.slice(1)}`;
}

export function renderGameStatus(state: GameState): HTMLElement {
  const status = document.createElement("section");
  status.classList.add("game-status");
  status.setAttribute("aria-label", "Current game status");

  const activePlayer = document.createElement("p");
  activePlayer.classList.add("active-player-status");
  activePlayer.textContent = `${capitalize(state.turn.activePlayer)} to move`;

  const details = document.createElement("div");
  details.classList.add("game-status-details");

  const blackRemaining = document.createElement("span");
  blackRemaining.classList.add("remaining-pieces", "remaining-black");
  blackRemaining.textContent = `Black: ${state.remainingPieces.black}`;

  const whiteRemaining = document.createElement("span");
  whiteRemaining.classList.add("remaining-pieces", "remaining-white");
  whiteRemaining.textContent = `White: ${state.remainingPieces.white}`;

  const placementCount = document.createElement("span");
  placementCount.classList.add("placement-count");
  placementCount.textContent = `Placements: ${state.turn.placements.length} / ${placementsPerTurn}`;

  details.append(blackRemaining, whiteRemaining, placementCount);
  status.append(activePlayer, details);

  return status;
}

/** Replaces the prior projection so no visual state survives a re-render. */
export function renderGameState(
  container: HTMLElement,
  state: GameState,
  presentation: BoardPresentationState = {},
): void {
  container.replaceChildren(
    renderGameStatus(state),
    renderBoard(state, presentation),
  );
}
