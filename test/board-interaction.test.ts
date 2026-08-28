// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createBoardSession,
  getPlacementTarget,
  isUndoAction,
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

function clickUndo(container: HTMLElement): void {
  clickTarget(container, ".undo-button");
}

function createRenderedSession(state = createInitialGameState(3, 12)) {
  const container = document.createElement("div");
  document.body.append(container);
  const render = vi.fn(renderGameState);
  const session = createBoardSession(container, state, render);
  sessions.push(session);

  return { container, render, session };
}

const sessions: ReturnType<typeof createBoardSession>[] = [];

afterEach(() => {
  for (const session of sessions) {
    session.disconnect();
  }

  sessions.length = 0;
  document.body.replaceChildren();
});

function createMultipleSupportState(): GameState {
  let state = createInitialGameState(3, 12);
  state = replaceSupplyPoint(state, 1, 1, controlledSupplyPoint());
  return replaceSupplyPoint(state, 1, 2, controlledSupplyPoint());
}

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
    expect(
      container.querySelector(
        '.guide-indicator[data-placement-legal="true"][data-kind="supply-point"][data-row="1"][data-column="2"]',
      ),
    ).toBeNull();
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("completes the turn after the third successful placement", () => {
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
    expect(currentState.turn.placements).toEqual([]);
    expect(currentState.turn.usedSupplyPoints).toEqual([]);
    expect(currentState.turn.activePlayer).toBe("white");
    expect(currentState.supplyPoints[1][2].player).toBe("black");
    expect(currentState.supplyPoints[2][2].player).toBe("black");
    expect(container.querySelector(".placement-count")?.textContent).toBe(
      "Placements: 0 / 3",
    );
    expect(container.querySelector(".active-player-status")?.textContent).toBe(
      "White to move",
    );
    expect(
      container.querySelector(
        '.guide-indicator[data-placement-legal="true"][data-kind="supply-point"][data-row="1"][data-column="2"]',
      ),
    ).not.toBeNull();
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

describe("Undo interaction", () => {
  test("is unavailable until a successful placement is made", () => {
    const { container, render, session } = createRenderedSession();

    const undoButton = container.querySelector<HTMLButtonElement>(
      ".undo-button",
    );
    expect(undoButton?.disabled).toBe(true);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );

    expect(session.getGameState().turn.placements).toHaveLength(1);
    expect(
      container.querySelector<HTMLButtonElement>(".undo-button")?.disabled,
    ).toBe(false);

    clickUndo(container);

    expect(session.getGameState().turn.placements).toEqual([]);
    expect(session.getGameState().remainingPieces.black).toBe(12);
    expect(session.getGameState().supplyPoints[1][2].pieces).toEqual([]);
    expect(
      container.querySelector<HTMLButtonElement>(".undo-button")?.disabled,
    ).toBe(true);
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("steps backward through successful placements across turn completion", () => {
    const initialState = createInitialGameState(3, 12);
    const { container, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );
    const afterFirstPlacement = session.getGameState();
    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );
    const afterSecondPlacement = session.getGameState();
    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );

    expect(session.getGameState().turn.activePlayer).toBe("white");
    expect(session.getGameState().supplyPoints[1][1].player).toBe("black");

    clickUndo(container);

    expect(session.getGameState()).toBe(afterSecondPlacement);
    expect(session.getGameState().turn.activePlayer).toBe("black");
    expect(session.getGameState().turn.placements).toHaveLength(2);
    expect(session.getGameState().supplyPoints[1][1].pieces).toEqual([
      "black",
      "black",
    ]);
    expect(session.getGameState().supplyPoints[1][1].player).toBeNull();
    expect(session.getGameState().supplyPoints[1][2].pieces).toEqual([]);
    expect(session.getGameState().remainingPieces.black).toBe(10);

    clickUndo(container);
    expect(session.getGameState()).toBe(afterFirstPlacement);

    clickUndo(container);
    expect(session.getGameState()).toBe(initialState);
  });

  test("restores an Objective placement and its used Supply Point", () => {
    const initialState = replaceSupplyPoint(
      createInitialGameState(3, 12),
      1,
      1,
      controlledSupplyPoint(),
    );
    const { container, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );
    expect(session.getGameState().turn.usedSupplyPoints).toEqual([
      { row: 1, column: 1 },
    ]);

    clickUndo(container);

    expect(session.getGameState()).toBe(initialState);
    expect(session.getGameState().objectives[1][1].pieces).toEqual([]);
    expect(session.getGameState().turn.usedSupplyPoints).toEqual([]);
    expect(session.getGameState().remainingPieces.black).toBe(12);
  });

  test("clears pending support selection without adding interaction history", () => {
    const initialState = createMultipleSupportState();
    const { container, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.supply-point-target[data-row="0"][data-column="0"]',
    );
    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );
    expect(session.getPendingSupportSelection()).not.toBeNull();

    clickUndo(container);

    expect(session.getGameState()).toBe(initialState);
    expect(session.getPendingSupportSelection()).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>(".undo-button")?.disabled,
    ).toBe(true);
  });

  test("illegal and cancelled selections do not create history entries", () => {
    const initialState = createMultipleSupportState();
    const { container, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="0"][data-column="0"]',
    );

    expect(session.getGameState()).toBe(initialState);
    expect(
      container.querySelector<HTMLButtonElement>(".undo-button")?.disabled,
    ).toBe(true);
  });
});

describe("Objective interaction", () => {
  test("requires explicit selection of the sole eligible support", () => {
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

    expect(session.getGameState()).toBe(initialState);
    expect(session.getGameState().objectives[1][1].pieces).toEqual([]);
    expect(session.getGameState().remainingPieces.black).toBe(12);
    expect(session.getGameState().turn.placements).toEqual([]);
    expect(session.getGameState().turn.usedSupplyPoints).toEqual([]);
    expect(session.getPendingSupportSelection()).toEqual({
      objective: { kind: "objective", row: 1, column: 1 },
      eligibleSupplyPoints: [{ row: 1, column: 1 }],
    });
    expect(
      container.querySelector(
        '.guide-indicator[data-support-eligible="true"][data-row="1"][data-column="1"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.guide-indicator[data-support-eligible="true"][data-row="1"][data-column="1"]',
      )?.hasAttribute("data-support-eligible"),
    ).toBe(true);
    expect(
      container.querySelector(
        '.guide-indicator[data-support-eligible="true"][data-row="0"][data-column="0"]',
      ),
    ).toBeNull();
    expect(container.querySelector('[data-placement-legal="true"]')).toBeNull();
    expect(render).toHaveBeenCalledTimes(2);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );

    const currentState = session.getGameState();
    expect(currentState).not.toBe(initialState);
    expect(currentState.objectives[1][1].pieces).toEqual(["black"]);
    expect(currentState.remainingPieces.black).toBe(11);
    expect(currentState.turn.placements).toEqual([
      { kind: "objective", row: 1, column: 1 },
    ]);
    expect(currentState.turn.usedSupplyPoints).toEqual([
      { row: 1, column: 1 },
    ]);
    expect(session.getPendingSupportSelection()).toBeNull();
    expect(container.querySelector('[data-support-eligible="true"]')).toBeNull();
    expect(container.querySelector("[data-support-eligible]")).toBeNull();
    expect(container.querySelector('[data-placement-legal="true"]'))
      .not.toBeNull();
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("enters selection mode and identifies only eligible supports", () => {
    const initialState = createMultipleSupportState();
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
    expect(session.getPendingSupportSelection()).toEqual({
      objective: { kind: "objective", row: 1, column: 1 },
      eligibleSupplyPoints: [
        { row: 1, column: 1 },
        { row: 1, column: 2 },
      ],
    });
    expect(
      Array.from(
        container.querySelectorAll<SVGElement>(
          '.guide-indicator[data-support-eligible="true"]',
        ),
      ).map((target) => [target.dataset.row, target.dataset.column]),
    ).toEqual([
      ["1", "1"],
      ["1", "2"],
    ]);
    expect(
      container.querySelectorAll('[data-support-eligible="true"]'),
    ).toHaveLength(2);
    expect(container.querySelector('[data-placement-legal="true"]')).toBeNull();
    expect(
      container.querySelector(
        '.supply-point-target[data-row="2"][data-column="1"]',
      )?.hasAttribute("data-support-eligible"),
    ).toBe(false);
    expect(render).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["first", 1, 1],
    ["second", 1, 2],
  ])(
    "applies the Objective with the %s eligible support",
    (_name, row, column) => {
      const initialState = createMultipleSupportState();
      const { container, render, session } = createRenderedSession(initialState);

      clickTarget(
        container,
        '.objective-target[data-row="1"][data-column="1"]',
      );
      clickTarget(
        container,
        `.supply-point-target[data-row="${row}"][data-column="${column}"]`,
      );

      const currentState = session.getGameState();
      expect(currentState).not.toBe(initialState);
      expect(currentState.objectives[1][1].pieces).toEqual(["black"]);
      expect(currentState.remainingPieces.black).toBe(11);
      expect(currentState.turn.placements).toEqual([
        { kind: "objective", row: 1, column: 1 },
      ]);
      expect(currentState.turn.usedSupplyPoints).toEqual([{ row, column }]);
      expect(session.getPendingSupportSelection()).toBeNull();
      expect(container.querySelector('[data-support-eligible="true"]'))
        .toBeNull();
      expect(container.querySelector("[data-support-eligible]")).toBeNull();
      expect(render).toHaveBeenCalledTimes(3);
    },
  );

  test("cancels selection from a non-eligible Supply Point", () => {
    const initialState = createMultipleSupportState();
    const { container, render, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="0"][data-column="0"]',
    );

    expect(session.getGameState()).toBe(initialState);
    expect(session.getGameState().objectives[1][1].pieces).toEqual([]);
    expect(session.getGameState().remainingPieces.black).toBe(12);
    expect(session.getGameState().turn.placements).toEqual([]);
    expect(session.getGameState().turn.usedSupplyPoints).toEqual([]);
    expect(session.getPendingSupportSelection()).toBeNull();
    expect(container.querySelector('[data-support-eligible="true"]')).toBeNull();
    expect(container.querySelector("[data-support-eligible]")).toBeNull();
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("cancels selection from another Objective without applying it", () => {
    const initialState = createMultipleSupportState();
    const { container, render, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );
    clickTarget(
      container,
      '.objective-target[data-row="0"][data-column="0"]',
    );

    expect(session.getGameState()).toBe(initialState);
    expect(session.getGameState().objectives[1][1].pieces).toEqual([]);
    expect(session.getGameState().objectives[0][0].pieces).toEqual([]);
    expect(session.getGameState().turn.usedSupplyPoints).toEqual([]);
    expect(session.getPendingSupportSelection()).toBeNull();
    expect(container.querySelector('[data-support-eligible="true"]')).toBeNull();
    expect(container.querySelector("[data-support-eligible]")).toBeNull();
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("does not handle selection clicks outside the board container", () => {
    const initialState = createMultipleSupportState();
    const { container, render, session } = createRenderedSession(initialState);
    const outsideButton = document.createElement("button");
    document.body.append(outsideButton);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );
    outsideButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(session.getGameState()).toBe(initialState);
    expect(session.getPendingSupportSelection()).not.toBeNull();
    expect(container.querySelectorAll('[data-support-eligible="true"]'))
      .toHaveLength(2);
    expect(render).toHaveBeenCalledTimes(2);
  });
});

describe("completed game flow", () => {
  test("completes an Objective third placement only after support selection", () => {
    let state = replaceSupplyPoint(
      createInitialGameState(3, 12),
      1,
      1,
      controlledSupplyPoint(),
    );
    state = replaceSupplyPoint(state, 0, 0, {
      pieces: ["black", "black"],
      secured: false,
      player: null,
    });
    state = {
      ...state,
      remainingPieces: { black: 10, white: 12 },
      turn: {
        ...state.turn,
        placements: [
          { kind: "supply-point", row: 0, column: 0 },
          { kind: "supply-point", row: 0, column: 0 },
        ],
      },
    };
    const { container, session } = createRenderedSession(state);

    clickTarget(
      container,
      '.objective-target[data-row="1"][data-column="1"]',
    );

    expect(session.getGameState()).toBe(state);
    expect(session.getGameState().turn.placements).toHaveLength(2);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );

    const completed = session.getGameState();
    expect(completed.turn.activePlayer).toBe("white");
    expect(completed.turn.placements).toEqual([]);
    expect(completed.turn.usedSupplyPoints).toEqual([]);
    expect(completed.objectives[1][1]).toMatchObject({
      pieces: ["black"],
      player: "black",
      secured: false,
    });
  });

  test("continues across Black and White turns", () => {
    const { container, session } = createRenderedSession();
    const targets = [
      '.supply-point-target[data-row="1"][data-column="1"]',
      '.supply-point-target[data-row="1"][data-column="1"]',
      '.supply-point-target[data-row="1"][data-column="2"]',
    ];

    for (const target of targets) {
      clickTarget(container, target);
    }

    expect(session.getGameState().turn.activePlayer).toBe("white");

    for (const target of targets) {
      clickTarget(container, target);
    }

    const state = session.getGameState();
    expect(state.turn.activePlayer).toBe("black");
    expect(state.turn.placements).toEqual([]);
    expect(state.remainingPieces).toEqual({ black: 9, white: 9 });
    expect(state.supplyPoints[1][1].pieces).toEqual([
      "black",
      "black",
      "white",
      "white",
    ]);
  });

  test("renders a final draw and blocks interaction after the final turn", () => {
    const initialState: GameState = {
      ...createInitialGameState(3, 3),
      remainingPieces: { black: 3, white: 0 },
    };
    const { container, render, session } = createRenderedSession(initialState);

    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="1"]',
    );
    clickTarget(
      container,
      '.supply-point-target[data-row="1"][data-column="2"]',
    );

    const terminalState = session.getGameState();
    expect(terminalState.remainingPieces).toEqual({ black: 0, white: 0 });
    expect(terminalState.turn.placements).toEqual([]);
    expect(container.querySelector(".game-result-heading")?.textContent).toBe(
      "Draw",
    );
    expect(container.querySelector(".active-player-status")?.textContent).toBe(
      "Game over",
    );
    expect(container.querySelector('[data-placement-legal="true"]')).toBeNull();
    expect(container.querySelector("[data-placement-legal]")).toBeNull();

    const rendersAtGameEnd = render.mock.calls.length;
    clickTarget(
      container,
      '.supply-point-target[data-row="2"][data-column="2"]',
    );

    expect(session.getGameState()).toBe(terminalState);
    expect(render).toHaveBeenCalledTimes(rendersAtGameEnd);
  });
});

describe("hit-target validation", () => {
  test("finds an Undo control from a nested SVG target", () => {
    const container = document.createElement("div");
    const undoButton = document.createElement("button");
    const icon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    undoButton.dataset.action = "undo";
    undoButton.append(icon);
    container.append(undoButton);

    expect(isUndoAction(icon, container)).toBe(true);
  });

  test("rejects an Undo control outside the delegated container", () => {
    const container = document.createElement("div");
    const undoButton = document.createElement("button");
    undoButton.dataset.action = "undo";

    expect(isUndoAction(undoButton, container)).toBe(false);
  });

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
