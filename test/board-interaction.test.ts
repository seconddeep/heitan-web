// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";

import {
  createBoardSession,
  getPlacementTarget,
  processPlacement,
} from "../src/board-interaction.ts";
import { renderGameState } from "../src/board-renderer.ts";
import {
  createInitialGameState,
  type GameState,
  type PointState,
} from "../src/game/game-state.ts";

function replaceSupplyPoint(
  state: GameState,
  row: number,
  column: number,
  point: PointState,
): GameState {
  return {
    ...state,
    supplyPoints: state.supplyPoints.map((currentRow, rowIndex) =>
      rowIndex === row
        ? currentRow.map((currentPoint, columnIndex) =>
            columnIndex === column ? point : currentPoint,
          )
        : currentRow,
    ),
  };
}

function controlledSupplyPoint(): PointState {
  return {
    pieces: ["black"],
    secured: false,
    player: "black",
  };
}

function clickTarget(
  container: HTMLElement,
  selector: string,
): void {
  const target = container.querySelector(selector);

  if (!(target instanceof Element)) {
    throw new Error(`Missing click target: ${selector}`);
  }

  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function createRenderedSession(state = createInitialGameState(3, 12)) {
  const container = document.createElement("div");
  const render = vi.fn(renderGameState);
  const session = createBoardSession(container, state, render);

  return { container, render, session };
}

describe("placement processing", () => {
  test("returns replacement state for a legal Supply Point", () => {
    const initialState = createInitialGameState(3, 12);

    const result = processPlacement(initialState, {
      kind: "supply-point",
      row: 1,
      column: 2,
    });

    expect(result).not.toBeNull();
    expect(result).not.toBe(initialState);
    expect(result?.supplyPoints[1][2].pieces).toEqual(["black"]);
    expect(result?.remainingPieces.black).toBe(11);
    expect(result?.turn.placements).toEqual([
      { kind: "supply-point", row: 1, column: 2 },
    ]);
  });

  test("returns null for an illegal Supply Point", () => {
    const initialState = replaceSupplyPoint(
      createInitialGameState(3, 12),
      1,
      2,
      {
        pieces: ["black", "black", "black"],
        secured: false,
        player: "black",
      },
    );

    const result = processPlacement(initialState, {
      kind: "supply-point",
      row: 1,
      column: 2,
    });

    expect(result).toBeNull();
    expect(initialState.supplyPoints[1][2].pieces).toEqual([
      "black",
      "black",
      "black",
    ]);
  });

  test("uses the sole eligible Supply Point for an Objective", () => {
    const initialState = replaceSupplyPoint(
      createInitialGameState(3, 12),
      1,
      1,
      controlledSupplyPoint(),
    );

    const result = processPlacement(initialState, {
      kind: "objective",
      row: 1,
      column: 1,
    });

    expect(result).not.toBeNull();
    expect(result?.objectives[1][1].pieces).toEqual(["black"]);
    expect(result?.turn.usedSupplyPoints).toEqual([{ row: 1, column: 1 }]);
  });

  test("returns null when an Objective has multiple eligible Supply Points", () => {
    let initialState = createInitialGameState(3, 12);
    initialState = replaceSupplyPoint(
      initialState,
      1,
      1,
      controlledSupplyPoint(),
    );
    initialState = replaceSupplyPoint(
      initialState,
      1,
      2,
      controlledSupplyPoint(),
    );

    const result = processPlacement(initialState, {
      kind: "objective",
      row: 1,
      column: 1,
    });

    expect(result).toBeNull();
    expect(initialState.objectives[1][1].pieces).toEqual([]);
    expect(initialState.turn.usedSupplyPoints).toEqual([]);
  });
});

describe("Supply Point interaction", () => {
  test("applies a legal click and re-renders from replacement state", () => {
    const initialState = createInitialGameState(3, 12);
    const { container, render, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );

    const currentState = session.getGameState();
    expect(currentState).not.toBe(initialState);
    expect(currentState.supplyPoints[1][2].pieces).toEqual(["black"]);
    expect(currentState.remainingPieces.black).toBe(11);
    expect(currentState.turn.placements).toEqual([
      { kind: "supply-point", row: 1, column: 2 },
    ]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(container.querySelector(".remaining-black")?.textContent).toBe(
      "Black: 11",
    );
    expect(container.querySelector(".placement-count")?.textContent).toBe(
      "Placements: 1 / 3",
    );
  });

  test("delegated listener handles a second click after SVG replacement", () => {
    const { container, render, session } = createRenderedSession();
    const firstSvg = container.querySelector("svg");

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );
    expect(container.querySelector("svg")).not.toBe(firstSvg);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );

    expect(session.getGameState().supplyPoints[1][2].pieces).toEqual([
      "black",
      "black",
    ]);
    expect(session.getGameState().turn.placements).toHaveLength(2);
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("does not complete the turn after the third successful placement", () => {
    const { container, session } = createRenderedSession();

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="2"][data-column="2"]',
    );

    const currentState = session.getGameState();
    expect(currentState.turn.placements).toHaveLength(3);
    expect(currentState.turn.activePlayer).toBe("black");
    expect(currentState.supplyPoints[1][2].player).toBeNull();
    expect(currentState.supplyPoints[2][2].player).toBeNull();
    expect(container.querySelector(".placement-count")?.textContent).toBe(
      "Placements: 3 / 3",
    );
  });

  test("an illegal click leaves state and projection unchanged", () => {
    const initialState = replaceSupplyPoint(
      createInitialGameState(3, 12),
      1,
      2,
      {
        pieces: ["black", "black", "black"],
        secured: false,
        player: "black",
      },
    );
    const { container, render, session } = createRenderedSession(initialState);
    const svg = container.querySelector("svg");

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );

    expect(session.getGameState()).toBe(initialState);
    expect(container.querySelector("svg")).toBe(svg);
    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe("Objective interaction", () => {
  test("uses the sole eligible supporting Supply Point", () => {
    const initialState = replaceSupplyPoint(
      createInitialGameState(3, 12),
      1,
      1,
      controlledSupplyPoint(),
    );
    const { container, render, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );

    const currentState = session.getGameState();
    expect(currentState.objectives[1][1].pieces).toEqual(["black"]);
    expect(currentState.remainingPieces.black).toBe(11);
    expect(currentState.turn.placements).toEqual([
      { kind: "objective", row: 1, column: 1 },
    ]);
    expect(currentState.turn.usedSupplyPoints).toEqual([
      { row: 1, column: 1 },
    ]);
    expect(render).toHaveBeenCalledTimes(2);
  });

  test("does not choose among multiple eligible supporting Supply Points", () => {
    let initialState = createInitialGameState(3, 12);
    initialState = replaceSupplyPoint(
      initialState,
      1,
      1,
      controlledSupplyPoint(),
    );
    initialState = replaceSupplyPoint(
      initialState,
      1,
      2,
      controlledSupplyPoint(),
    );
    const { container, render, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );

    expect(session.getGameState()).toBe(initialState);
    expect(session.getGameState().objectives[1][1].pieces).toEqual([]);
    expect(session.getGameState().remainingPieces.black).toBe(12);
    expect(session.getGameState().turn.placements).toEqual([]);
    expect(session.getGameState().turn.usedSupplyPoints).toEqual([]);
    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe("hit-target validation", () => {
  test.each([
    ["grid line", ".board-grid line"],
    ["status", ".game-status"],
    ["container", ".board-container"],
  ])("ignores a %s click", (_name, selector) => {
    const { container, render, session } = createRenderedSession();
    const target =
      selector === ".board-container"
        ? container
        : container.querySelector(selector);

    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(session.getGameState().turn.placements).toEqual([]);
    expect(render).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["missing row", undefined, "1"],
    ["empty row", "", "1"],
    ["fractional row", "1.5", "1"],
    ["non-numeric column", "1", "right"],
  ])("rejects %s metadata", (_name, row, column) => {
    const target = document.createElement("button");
    target.classList.add("supply-point-target");
    target.dataset.kind = "supply-point";

    if (row !== undefined) {
      target.dataset.row = row;
    }

    target.dataset.column = column;

    expect(getPlacementTarget(target)).toBeNull();
  });

  test("rejects metadata whose kind disagrees with the target class", () => {
    const target = document.createElement("button");
    target.classList.add("objective-target");
    target.dataset.kind = "supply-point";
    target.dataset.row = "0";
    target.dataset.column = "0";

    expect(getPlacementTarget(target)).toBeNull();
  });
});
