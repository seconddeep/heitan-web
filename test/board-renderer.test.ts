// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";

import {
  createBoardSvgLayout,
  renderBoard,
  renderFinalResult,
  renderGameState,
  renderGameStatus,
} from "../src/board-renderer.ts";
import {
  createInitialGameState,
  type GameState,
  type Player,
  type PointState,
} from "../src/game/game-state.ts";
import type { GameConfiguration } from "../src/game-configuration.ts";

function pointState(
  pieces: readonly Player[],
  player: Player | null = null,
  secured = false,
): PointState {
  if (secured) {
    if (player === null) {
      throw new Error("A secured test point needs a player");
    }

    return {
      pieces,
      secured: true,
      player,
    };
  }

  return {
    pieces,
    secured: false,
    player,
  };
}

function replacePoint(
  matrix: readonly (readonly PointState[])[],
  row: number,
  column: number,
  point: PointState,
): readonly (readonly PointState[])[] {
  return matrix.map((currentRow, rowIndex) =>
    rowIndex === row
      ? currentRow.map((currentPoint, columnIndex) =>
          columnIndex === column ? point : currentPoint,
        )
      : currentRow,
  );
}

function selector(
  className: string,
  kind: "supply-point" | "objective",
  row: number,
  column: number,
): string {
  return `.${className}[data-kind="${kind}"][data-row="${row}"][data-column="${column}"]`;
}

describe.each([4, 7])("%i by %i board SVG layout", (cellsPerSide) => {
  const layout = createBoardSvgLayout(cellsPerSide);

  test("creates horizontal and vertical grid lines", () => {
    expect(layout.gridLines).toHaveLength((cellsPerSide + 1) * 2);
  });

  test("creates the expected number of Supply Points and Objectives", () => {
    expect(layout.supplyPoints).toHaveLength((cellsPerSide + 1) ** 2);
    expect(layout.objectives).toHaveLength(cellsPerSide ** 2);
  });

  test("places points using generic row and column coordinates", () => {
    expect(layout.supplyPoints).toEqual(
      expect.arrayContaining([
        { row: 0, column: 0, x: 0, y: 0 },
        {
          row: cellsPerSide,
          column: cellsPerSide,
          x: cellsPerSide,
          y: cellsPerSide,
        },
      ]),
    );
    expect(layout.objectives.at(-1)).toEqual({
      row: cellsPerSide - 1,
      column: cellsPerSide - 1,
      x: cellsPerSide - 0.5,
      y: cellsPerSide - 0.5,
    });
  });
});

describe.each([4, 7])("%i by %i rendered board", (cellsPerSide) => {
  const state = createInitialGameState(cellsPerSide, 12);
  const svg = renderBoard(state);

  test("preserves responsive SVG sizing", () => {
    expect(svg.getAttribute("viewBox")).toBe(
      `-0.74 -0.74 ${cellsPerSide + 1.48} ${cellsPerSide + 1.48}`,
    );
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  test("renders coordinate hit targets without Supply Point markers", () => {
    expect(svg.querySelector(".supply-point")).toBeNull();
    expect(svg.querySelector(".supply-point-marker-layer")).toBeNull();
    expect(svg.querySelectorAll(".supply-point-target")).toHaveLength(
      (cellsPerSide + 1) ** 2,
    );
    expect(svg.querySelectorAll(".objective-target")).toHaveLength(
      cellsPerSide ** 2,
    );
    expect(svg.querySelector(".point-state")).toBeNull();
  });

  test("keeps visual layers below the hit targets", () => {
    const children = Array.from(svg.children);
    const targetLayer = svg.querySelector(".hit-target-layer")!;

    expect(children.at(-1)).toBe(targetLayer);
    expect(children.indexOf(svg.querySelector(".piece-layer")!)).toBeLessThan(
      children.indexOf(targetLayer),
    );
  });

  test("maps hit targets to every zero-based board coordinate", () => {
    const supplyTargets = Array.from(
      svg.querySelectorAll<SVGCircleElement>(".supply-point-target"),
    );
    const objectiveTargets = Array.from(
      svg.querySelectorAll<SVGRectElement>(".objective-target"),
    );

    for (const [index, target] of supplyTargets.entries()) {
      expect(target.dataset).toMatchObject({
        kind: "supply-point",
        row: String(Math.floor(index / (cellsPerSide + 1))),
        column: String(index % (cellsPerSide + 1)),
      });
    }

    for (const [index, target] of objectiveTargets.entries()) {
      expect(target.dataset).toMatchObject({
        kind: "objective",
        row: String(Math.floor(index / cellsPerSide)),
        column: String(index % cellsPerSide),
      });
    }
  });
});

describe("legal placement target rendering", () => {
  test.each([4, 7])(
    "derives legal Supply Point targets for a %i-cell board",
    (cellsPerSide) => {
      const svg = renderBoard(createInitialGameState(cellsPerSide, 12));

      expect(
        svg.querySelectorAll(
          '.guide-indicator[data-kind="supply-point"][data-placement-legal="true"]',
        ),
      ).toHaveLength((cellsPerSide + 1) ** 2);
      expect(
        svg.querySelectorAll(
          '.guide-indicator[data-placement-legal="true"][data-kind="supply-point"][r="0.07"]',
        ),
      ).toHaveLength((cellsPerSide + 1) ** 2);
      expect(
        svg.querySelectorAll(
          '.guide-indicator[data-placement-legal="true"][data-kind="objective"]',
        ),
      )
        .toHaveLength(0);
    },
  );

  test("derives legal Objectives from their eligible supporting Supply Points", () => {
    const initialState = createInitialGameState(3, 12);
    const state: GameState = {
      ...initialState,
      supplyPoints: replacePoint(
        initialState.supplyPoints,
        1,
        1,
        pointState(["black"], "black"),
      ),
    };
    const svg = renderBoard(state);
    const legalObjectiveCoordinates = Array.from(
      svg.querySelectorAll<SVGCircleElement>(
        '.guide-indicator[data-placement-legal="true"][data-kind="objective"]',
      ),
    ).map((target) => [target.dataset.row, target.dataset.column]);

    expect(legalObjectiveCoordinates).toEqual([
      ["0", "0"],
      ["0", "1"],
      ["1", "0"],
      ["1", "1"],
    ]);
    expect(
      svg.querySelectorAll(
        '.guide-indicator[data-placement-legal="true"][data-kind="objective"][r="0.07"]',
      ),
    ).toHaveLength(4);
    expect(svg.querySelector('[data-support-eligible="true"]')).toBeNull();
  });

  test("shows only eligible supports during Objective support selection", () => {
    const initialState = createInitialGameState(3, 12);
    const state: GameState = {
      ...initialState,
      supplyPoints: replacePoint(
        initialState.supplyPoints,
        1,
        1,
        pointState(["black"], "black"),
      ),
    };
    const svg = renderBoard(state, {
      eligibleSupplyPoints: [{ row: 1, column: 1 }],
    });

    expect(svg.querySelector('[data-placement-legal="true"]')).toBeNull();
    expect(
      svg.querySelectorAll(
        '.guide-indicator[data-support-eligible="true"][r="0.07"]',
      ),
    ).toHaveLength(1);
    expect(
      svg.querySelector(
        '.guide-indicator[data-support-eligible="true"][data-row="1"][data-column="1"]',
      ),
    ).not.toBeNull();
  });

  test("does not mark targets rejected by placement legality", () => {
    const initialState = createInitialGameState(3, 12);
    const state: GameState = {
      ...initialState,
      remainingPieces: { black: 7, white: 12 },
      supplyPoints: replacePoint(
        replacePoint(
          initialState.supplyPoints,
          0,
          0,
          pointState(["black", "black", "black"], "black"),
        ),
        0,
        1,
        pointState(["black", "black"], "black"),
      ),
      turn: {
        ...initialState.turn,
        placements: [
          { kind: "supply-point", row: 0, column: 1 },
          { kind: "supply-point", row: 0, column: 1 },
        ],
      },
    };
    const svg = renderBoard(state);

    for (const [row, column] of [[0, 0], [0, 1]] as const) {
      const indicator = svg.querySelector(
        `.guide-indicator[data-placement-legal="true"][data-kind="supply-point"][data-row="${row}"][data-column="${column}"]`,
      );
      expect(indicator).toBeNull();
    }
  });

  test("positions guides at the center of each top stacked piece", () => {
    const initialState = createInitialGameState(3, 12);
    const state: GameState = {
      ...initialState,
      supplyPoints: replacePoint(
        replacePoint(
          initialState.supplyPoints,
          0,
          0,
          pointState(["black", "white"], "black"),
        ),
        1,
        1,
        pointState(["black"], "black"),
      ),
      objectives: replacePoint(
        initialState.objectives,
        1,
        1,
        pointState(["white", "black"], "black"),
      ),
    };
    const svg = renderBoard(state);

    for (const [kind, row, column] of [
      ["supply-point", 0, 0],
      ["objective", 1, 1],
    ] as const) {
      const stack = svg.querySelector(
        selector("piece-stack", kind, row, column),
      );
      const topPiece = stack?.lastElementChild;
      const guide = svg.querySelector(
        `.guide-indicator[data-kind="${kind}"][data-row="${row}"][data-column="${column}"]`,
      );

      expect(guide?.getAttribute("cy")).toBe(topPiece?.getAttribute("cy"));

      if (kind === "supply-point") {
        const target = svg.querySelector(
          selector("supply-point-target", kind, row, column),
        );

        expect(target?.getAttribute("cy")).toBe(
          topPiece?.getAttribute("cy"),
        );
      }
    }
  });

  test("clears legal placement feedback after game end", () => {
    const initialState = createInitialGameState(3, 1);
    const terminalState: GameState = {
      ...initialState,
      remainingPieces: { black: 0, white: 0 },
    };
    const svg = renderBoard(terminalState);

    expect(svg.querySelector('[data-placement-legal="true"]')).toBeNull();
    expect(svg.querySelector("[data-placement-legal]")).toBeNull();
  });
});

test("contains five-piece stacks at every outer Supply corner", () => {
  const cellsPerSide = 4;
  const initialState = createInitialGameState(cellsPerSide, 36);
  let supplyPoints = initialState.supplyPoints;

  for (const [row, column] of [
    [0, 0],
    [0, cellsPerSide],
    [cellsPerSide, 0],
    [cellsPerSide, cellsPerSide],
  ] as const) {
    supplyPoints = replacePoint(
      supplyPoints,
      row,
      column,
      pointState(
        ["black", "white", "black", "white", "black"],
        "black",
        true,
      ),
    );
  }

  const svg = renderBoard({ ...initialState, supplyPoints });
  const [minimumX, minimumY, width, height] = svg
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  const maximumX = minimumX + width;
  const maximumY = minimumY + height;
  const halfStrokeWidth = 0.025 / 2;

  for (const piece of svg.querySelectorAll<SVGCircleElement>(".piece")) {
    const x = Number(piece.getAttribute("cx"));
    const y = Number(piece.getAttribute("cy"));
    const outerRadius = Number(piece.getAttribute("r")) + halfStrokeWidth;

    expect(x - outerRadius).toBeGreaterThanOrEqual(minimumX);
    expect(x + outerRadius).toBeLessThanOrEqual(maximumX);
    expect(y - outerRadius).toBeGreaterThanOrEqual(minimumY);
    expect(y + outerRadius).toBeLessThanOrEqual(maximumY);
  }
});

describe("Supply Point rendering", () => {
  const initialState = createInitialGameState(3, 12);
  const state: GameState = {
    ...initialState,
    supplyPoints: replacePoint(
      replacePoint(
        replacePoint(
          replacePoint(
            replacePoint(
              initialState.supplyPoints,
              0,
              1,
              pointState(["black"]),
            ),
            0,
            2,
            pointState(["black", "white", "black", "white", "black"]),
          ),
          1,
          0,
          pointState(["black", "white", "black"], "black"),
        ),
        1,
        1,
        pointState(["white", "black", "white"], "white"),
      ),
      1,
      2,
      pointState(["black", "white", "black", "black"], "black", true),
    ),
  };
  const svg = renderBoard(state);

  test("keeps an empty Supply Point unmarked and free of pieces", () => {
    expect(
      svg.querySelector('.supply-point[cx="0"][cy="0"]'),
    ).toBeNull();
    expect(
      svg.querySelector(selector("piece-stack", "supply-point", 0, 0)),
    ).toBeNull();
  });

  test("renders one Black piece and generic multi-player stacks", () => {
    const oneBlack = svg.querySelector(
      selector("piece-stack", "supply-point", 0, 1),
    );
    const mixedStack = svg.querySelector(
      selector("piece-stack", "supply-point", 0, 2),
    );

    expect(oneBlack?.querySelectorAll(".black-piece")).toHaveLength(1);
    expect(mixedStack?.querySelectorAll(".black-piece")).toHaveLength(3);
    expect(mixedStack?.querySelectorAll(".white-piece")).toHaveLength(2);
  });

  test("draws a vertical stack from its bottom disc to its top disc", () => {
    const pieces = Array.from(
      svg.querySelectorAll<SVGCircleElement>(
        `${selector("piece-stack", "supply-point", 0, 2)} .piece`,
      ),
    );
    const xPositions = pieces.map((piece) => piece.getAttribute("cx"));
    const yPositions = pieces.map((piece) => Number(piece.getAttribute("cy")));
    const stackIndexes = pieces.map((piece) =>
      Number(piece.dataset.stackIndex),
    );
    const players = pieces.map((piece) => piece.dataset.player);

    expect(pieces).toHaveLength(5);
    expect(new Set(xPositions)).toEqual(new Set(["2"]));
    expect(stackIndexes).toEqual([0, 1, 2, 3, 4]);
    expect(players).toEqual(["black", "white", "black", "white", "black"]);
    expect(yPositions).toEqual([...yPositions].sort((a, b) => b - a));
    expect(yPositions[0]).toBe(0);
    expect(new Set(yPositions).size).toBe(5);
    for (let index = 1; index < yPositions.length; index += 1) {
      expect(yPositions[index - 1] - yPositions[index]).toBeCloseTo(0.1);
    }
    expect(pieces.every((piece) => piece.getAttribute("r") === "0.24"))
      .toBe(true);
  });

  test("renders pieces without Control or Secured feedback", () => {
    expect(svg.querySelector(".point-state")).toBeNull();
    expect(svg.querySelector("[data-secured]")).toBeNull();
    expect(
      svg.querySelector(
        selector("piece-stack", "supply-point", 1, 0),
      )?.querySelectorAll(".black-piece"),
    ).toHaveLength(2);
    expect(
      svg.querySelector(
        selector("piece-stack", "supply-point", 1, 2),
      )?.querySelectorAll(".black-piece"),
    ).toHaveLength(3);
  });
});

describe("Objective rendering", () => {
  const initialState = createInitialGameState(3, 12);
  const state: GameState = {
    ...initialState,
    objectives: replacePoint(
      replacePoint(
        replacePoint(
          replacePoint(
            initialState.objectives,
            0,
            1,
            pointState(["black", "white", "black"]),
          ),
          0,
          2,
          pointState(["white", "black"], "black"),
        ),
        1,
        0,
        pointState(["black", "white", "white"], "white"),
      ),
      1,
      1,
      pointState(["white", "white", "white"], "white", true),
    ),
  };
  const svg = renderBoard(state);

  test("does not decorate an empty Neutral Objective", () => {
    expect(
      svg.querySelector(selector("piece-stack", "objective", 0, 0)),
    ).toBeNull();
    expect(
      svg.querySelectorAll(
        '[data-kind="objective"][data-row="0"][data-column="0"]',
      ),
    ).toHaveLength(1);
  });

  test("renders Black and White Objective pieces", () => {
    expect(
      svg.querySelector(
        selector("piece-stack", "objective", 0, 1),
      )?.querySelectorAll(".black-piece"),
    ).toHaveLength(2);
    expect(
      svg.querySelector(
        selector("piece-stack", "objective", 0, 1),
      )?.querySelectorAll(".white-piece"),
    ).toHaveLength(1);
  });

  test("renders pieces without Advantage or Secured feedback", () => {
    expect(svg.querySelector(".point-state")).toBeNull();
    expect(svg.querySelector("[data-secured]")).toBeNull();
    expect(
      svg.querySelector(
        selector("piece-stack", "objective", 0, 2),
      )?.querySelectorAll(".black-piece"),
    ).toHaveLength(1);
    expect(
      svg.querySelector(
        selector("piece-stack", "objective", 1, 1),
      )?.querySelectorAll(".white-piece"),
    ).toHaveLength(3);
  });
});

test("renders turn and remaining-piece status directly from GameState", () => {
  const initialState = createInitialGameState(3, 12);
  const state: GameState = {
    ...initialState,
    remainingPieces: { black: 7, white: 9 },
    turn: {
      ...initialState.turn,
      activePlayer: "white",
      placements: [
        { kind: "supply-point", row: 0, column: 0 },
        { kind: "objective", row: 0, column: 0 },
      ],
    },
  };
  const configuration: GameConfiguration = {
    id: "3x3",
    label: "3 × 3",
    cellsPerSide: 3,
    piecesPerPlayer: 12,
  };
  const status = renderGameStatus(state, configuration);

  expect(status.querySelector(".active-player-status")?.textContent).toBe(
    "White to move",
  );
  expect(status.querySelector(".remaining-black")?.textContent).toBe(
    "Black: 7",
  );
  expect(status.querySelector(".remaining-white")?.textContent).toBe(
    "White: 9",
  );
  expect(status.querySelector(".placement-count")?.textContent).toBe(
    "Placements: 2 / 3",
  );
  expect(status.querySelector(".turn-count")?.textContent).toBe(
    "Turn: 3 / 8",
  );
});

test.each([
  ["black", "Black wins"],
  ["white", "White wins"],
] as const)("renders a %s win from terminal Objective scores", (player, title) => {
  const initialState = createInitialGameState(3, 3);
  const state: GameState = {
    ...initialState,
    remainingPieces: { black: 0, white: 0 },
    objectives: replacePoint(
      initialState.objectives,
      0,
      0,
      pointState([player, player, player], player, true),
    ),
  };
  const result = renderFinalResult(state);

  expect(result?.querySelector(".game-result-heading")?.textContent).toBe(title);
  expect(
    Array.from(result?.querySelectorAll("tbody tr") ?? []).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent),
    ),
  ).toEqual([
    [
      "Secured Objectives",
      player === "black" ? "1" : "0",
      player === "white" ? "1" : "0",
    ],
    ["Advantage Objectives", "0", "0"],
    [
      "Pieces on Advantage Objectives",
      "0",
      "0",
    ],
  ]);
});

test("does not calculate or render a result for an unfinished game", () => {
  expect(renderFinalResult(createInitialGameState(3, 12))).toBeNull();
});

test("re-rendering replaces all stale board and status visuals", () => {
  const initialState = createInitialGameState(3, 12);
  const firstState: GameState = {
    ...initialState,
    supplyPoints: replacePoint(
      initialState.supplyPoints,
      0,
      0,
      pointState(["black", "black"], "black"),
    ),
  };
  const secondState: GameState = {
    ...initialState,
    remainingPieces: { black: 10, white: 8 },
    supplyPoints: replacePoint(
      initialState.supplyPoints,
      0,
      0,
      pointState(["white"], "white"),
    ),
    turn: {
      ...initialState.turn,
      activePlayer: "white",
      placements: [{ kind: "supply-point", row: 0, column: 0 }],
    },
  };
  const container = document.createElement("div");

  renderGameState(container, firstState);
  const originalSvg = container.querySelector("svg");
  expect(container.querySelectorAll(".black-piece")).toHaveLength(2);

  renderGameState(container, secondState);

  expect(container.querySelector("svg")).not.toBe(originalSvg);
  expect(container.querySelector(".black-piece")).toBeNull();
  expect(container.querySelectorAll(".white-piece")).toHaveLength(1);
  expect(container.querySelector(".point-state")).toBeNull();
  expect(container.querySelector(".active-player-status")?.textContent).toBe(
    "White to move",
  );
  expect(container.querySelector(".remaining-black")?.textContent).toBe(
    "Black: 10",
  );
  expect(container.querySelector(".placement-count")?.textContent).toBe(
    "Placements: 1 / 3",
  );
  expect(container.querySelectorAll(".supply-point-target")).toHaveLength(16);
});

test("rendering does not mutate GameState", () => {
  const initialState = createInitialGameState(3, 12);
  const state: GameState = {
    ...initialState,
    objectives: replacePoint(
      initialState.objectives,
      1,
      1,
      pointState(["black", "white", "black"], "black"),
    ),
  };
  const before = JSON.stringify(state);

  renderBoard(state);
  renderGameStatus(state);

  expect(JSON.stringify(state)).toBe(before);
});
