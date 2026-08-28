import {
  getObjectiveCoordinates,
  getSupplyPointCoordinates,
  type BoardCoordinate,
  validateBoardSize,
} from "./game/board-geometry.ts";
import { isGameOver } from "./game/game-flow.ts";
import { calculateGameResult } from "./game/game-result.ts";
import { countPieces } from "./game/game-state.ts";
import type { GameState, Player, PointState } from "./game/game-state.ts";
import {
  evaluateObjectivePlacement,
  evaluateSupplyPointPlacement,
} from "./game/placement-legality.ts";
import {
  getTotalTurnCount,
  type GameConfiguration,
} from "./game-configuration.ts";

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
  readonly canUndo?: boolean;
}

const svgNamespace = "http://www.w3.org/2000/svg";
const legalPlacementIndicatorRadius = 0.07;
const supplyPointHitRadius = 0.3;
const pieceRadius = 0.24;
const pieceStackStep = 0.1;
// A legal point can hold five pieces (3 for one player and 2 for the other).
// The padding contains a hit target centered on a row-0 five-piece stack.
const viewBoxPadding = 0.74;
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
    piece.setAttribute("cy", String(position.y - stackIndex * pieceStackStep));
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

function getTopPieceCenterY(
  point: PointState,
  position: SvgPosition,
): number {
  const topPieceIndex = Math.max(point.pieces.length - 1, 0);

  return position.y - topPieceIndex * pieceStackStep;
}

function appendGuideIndicator(
  guideLayer: SVGGElement,
  point: PointState,
  position: SvgPosition,
  kind: "supply-point" | "objective",
  feedback: "legal-placement" | "eligible-support",
): void {
  const indicator = createSvgElement("circle");
  indicator.classList.add("guide-indicator");

  if (feedback === "legal-placement") {
    indicator.dataset.placementLegal = "true";
  } else {
    indicator.dataset.supportEligible = "true";
  }

  indicator.setAttribute("cx", String(position.x));
  indicator.setAttribute(
    "cy",
    String(getTopPieceCenterY(point, position)),
  );
  indicator.setAttribute("r", String(legalPlacementIndicatorRadius));
  setCoordinateMetadata(indicator, position, kind);
  guideLayer.append(indicator);
}

function appendGuideIndicators(
  guideLayer: SVGGElement,
  state: GameState,
  layout: BoardSvgLayout,
  presentation: BoardPresentationState,
): void {
  if (isGameOver(state)) {
    return;
  }

  if (presentation.eligibleSupplyPoints !== undefined) {
    for (const position of layout.supplyPoints) {
      if (
        presentation.eligibleSupplyPoints.some((coordinate) =>
          coordinatesMatch(coordinate, position),
        )
      ) {
        appendGuideIndicator(
          guideLayer,
          getPointState(state, position, "supply-point"),
          position,
          "supply-point",
          "eligible-support",
        );
      }
    }

    return;
  }

  for (const position of layout.objectives) {
    if (evaluateObjectivePlacement(state, position).legal) {
      appendGuideIndicator(
        guideLayer,
        getPointState(state, position, "objective"),
        position,
        "objective",
        "legal-placement",
      );
    }
  }

  for (const position of layout.supplyPoints) {
    if (evaluateSupplyPointPlacement(state, position).legal) {
      appendGuideIndicator(
        guideLayer,
        getPointState(state, position, "supply-point"),
        position,
        "supply-point",
        "legal-placement",
      );
    }
  }
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

  const pieceLayer = createSvgElement("g");
  pieceLayer.classList.add("piece-layer");
  const guideLayer = createSvgElement("g");
  guideLayer.classList.add("guide-layer");
  const targetLayer = createSvgElement("g");
  targetLayer.classList.add("hit-target-layer");

  appendGuideIndicators(guideLayer, state, layout, presentation);

  for (const position of layout.supplyPoints) {
    const point = getPointState(state, position, "supply-point");

    appendPointPieces(pieceLayer, position, "supply-point", point);
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
    const point = getPointState(state, position, "supply-point");
    const target = createSvgElement("circle");
    target.classList.add("supply-point-target");
    target.setAttribute("cx", String(position.x));
    target.setAttribute("cy", String(getTopPieceCenterY(point, position)));
    target.setAttribute("r", String(supplyPointHitRadius));
    setCoordinateMetadata(target, position, "supply-point");

    targetLayer.append(target);
  }

  svg.append(grid, pieceLayer, guideLayer, targetLayer);

  return svg;
}

function capitalize(player: Player): string {
  return `${player[0].toUpperCase()}${player.slice(1)}`;
}

export interface TurnDisplay {
  readonly currentTurn: number;
  readonly totalTurns: number;
  readonly placements: number;
}

export function deriveTurnDisplay(
  state: GameState,
  configuration: GameConfiguration,
): TurnDisplay {
  const remainingPieces = state.remainingPieces[state.turn.activePlayer];
  const totalTurns = getTotalTurnCount(configuration);
  const currentTurn = Math.min(
    totalTurns,
    Math.floor(
      (configuration.piecesPerPlayer - remainingPieces) /
        placementsPerTurn,
    ) + 1,
  );

  return {
    currentTurn,
    totalTurns,
    placements: state.turn.placements.length,
  };
}

export function renderGameStatus(
  state: GameState,
  configuration: GameConfiguration,
): HTMLElement {
  const status = document.createElement("section");
  status.classList.add("game-status");
  status.setAttribute("aria-label", "Current game status");

  const activePlayer = document.createElement("p");
  activePlayer.classList.add("active-player-status");
  activePlayer.textContent = isGameOver(state)
    ? "Game over"
    : `${capitalize(state.turn.activePlayer)} to move`;

  const details = document.createElement("div");
  details.classList.add("game-status-details");
  const turnDisplay = deriveTurnDisplay(state, configuration);

  const turnCount = document.createElement("span");
  turnCount.classList.add("turn-count");
  turnCount.textContent = `Turn ${turnDisplay.currentTurn} / ${turnDisplay.totalTurns}`;

  const placementCount = document.createElement("span");
  placementCount.classList.add("placement-count");
  placementCount.textContent = `Placements ${turnDisplay.placements} / ${placementsPerTurn}`;

  details.append(turnCount, placementCount);
  status.append(activePlayer, details);

  return status;
}

export function renderGameControls(
  presentation: BoardPresentationState = {},
): HTMLElement {
  const controls = document.createElement("div");
  controls.classList.add("game-controls");

  const undoButton = document.createElement("button");
  undoButton.classList.add("undo-button");
  undoButton.type = "button";
  undoButton.dataset.action = "undo";
  undoButton.textContent = "Undo";
  undoButton.disabled = presentation.canUndo !== true;

  controls.append(undoButton);

  return controls;
}

export function renderFinalResult(state: GameState): HTMLElement | null {
  if (!isGameOver(state)) {
    return null;
  }

  const result = calculateGameResult(state);

  if (!result.finished) {
    throw new Error("A terminal GameState must produce a final result");
  }

  const resultSection = document.createElement("section");
  resultSection.classList.add("game-result");
  resultSection.setAttribute("aria-label", "Final result");

  const heading = document.createElement("h2");
  heading.classList.add("game-result-heading");
  heading.textContent =
    result.winner === null ? "Draw" : `${capitalize(result.winner)} wins`;

  const table = document.createElement("table");
  table.classList.add("objective-scores");
  const caption = document.createElement("caption");
  caption.textContent = "Final Objective scores";
  const head = document.createElement("thead");
  head.innerHTML = `
    <tr>
      <th scope="col">Score</th>
      <th scope="col">Black</th>
      <th scope="col">White</th>
    </tr>
  `;
  const body = document.createElement("tbody");

  for (const [label, key] of [
    ["Secured Objectives", "secured"],
    ["Advantage Objectives", "advantage"],
    ["Pieces on Advantage Objectives", "advantagePieces"],
  ] as const) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <th scope="row">${label}</th>
      <td>${result.scores.black[key]}</td>
      <td>${result.scores.white[key]}</td>
    `;
    body.append(row);
  }

  table.append(caption, head, body);
  resultSection.append(heading, table);

  return resultSection;
}

/** Replaces the prior projection so no visual state survives a re-render. */
export function renderGameState(
  container: HTMLElement,
  state: GameState,
  presentation: BoardPresentationState = {},
  configuration: GameConfiguration,
): void {
  const result = renderFinalResult(state);
  const children: Node[] = [
    renderGameStatus(state, configuration),
    renderGameControls(presentation),
  ];

  if (result !== null) {
    children.push(result);
  }

  children.push(renderBoard(state, presentation));
  container.replaceChildren(...children);
}
