// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from "vitest";

import type { ProductAnalytics } from "../src/analytics.ts";
import { createGameApp, type GameApp } from "../src/game-app.ts";
import type { GameConfiguration } from "../src/game-configuration.ts";

let gameApp: GameApp | undefined;

afterEach(() => {
  gameApp?.disconnect();
  gameApp = undefined;
  document.body.replaceChildren();
});

function createApp(
  analytics?: ProductAnalytics,
  configuration?: GameConfiguration,
): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  gameApp = configuration
    ? createGameApp(root, [configuration], configuration, analytics)
    : createGameApp(root, undefined, undefined, analytics);
  return root;
}

function createAnalyticsSpy(): {
  readonly analytics: ProductAnalytics;
  readonly track: ReturnType<typeof vi.fn<ProductAnalytics["track"]>>;
} {
  const track = vi.fn<ProductAnalytics["track"]>();
  return { analytics: { track }, track };
}

function click(root: HTMLElement, selector: string): void {
  const target = root.querySelector(selector);
  if (!(target instanceof Element)) {
    throw new Error(`Missing target: ${selector}`);
  }
  target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

function startGame(root: HTMLElement, configurationId: string): void {
  const select = root.querySelector<HTMLSelectElement>("#board-size");
  const form = root.querySelector<HTMLFormElement>(".new-game-form");
  if (!select || !form) {
    throw new Error("Missing new-game controls");
  }
  click(root, '[data-action="open-new-game"]');
  select.value = configurationId;
  form.dispatchEvent(
    new SubmitEvent("submit", { bubbles: true, cancelable: true }),
  );
}

describe("app navigation", () => {
  test("places the game title in the top navigation", () => {
    const root = createApp();
    const title = root.querySelector("h1");

    expect(title?.textContent).toBe("Heitan");
    expect(title?.classList.contains("app-navigation-title")).toBe(true);
    expect(title?.closest(".app-navigation")).not.toBeNull();
    expect(root.querySelector(".app-header h1")).toBeNull();
  });

  test("links to the canonical rules in a new tab", () => {
    const root = createApp();
    const rulesLink = root.querySelector<HTMLAnchorElement>(".rules-link");

    expect(rulesLink?.textContent).toBe("Rules");
    expect(rulesLink?.href).toBe(
      "https://github.com/seconddeep/heitan-ludii/blob/main/docs/rules.md",
    );
    expect(rulesLink?.target).toBe("_blank");
    expect(rulesLink?.rel).toBe("noopener noreferrer");
    expect(rulesLink?.closest(".app-navigation")).toContain(
      root.querySelector(".new-game-button"),
    );
  });

  test("tracks opening the rules", () => {
    const { analytics, track } = createAnalyticsSpy();
    const root = createApp(analytics);
    root.querySelector(".rules-link")?.addEventListener(
      "click",
      (event) => event.preventDefault(),
      { once: true },
    );

    click(root, ".rules-link");

    expect(track).toHaveBeenCalledWith({ name: "rules_open" });
  });
});

describe("new-game flow", () => {
  test("starts with the canonical 4 × 4 configuration", () => {
    const root = createApp();

    expect(gameApp?.getConfiguration().id).toBe("4x4");
    expect(
      Array.from(root.querySelectorAll<HTMLOptionElement>("#board-size option"))
        .map((option) => option.textContent),
    ).toEqual([
      "3 × 3 - Prototype",
      "4 × 4 - Compact",
      "5 × 5 - Compact",
      "6 × 6 - Analysis",
      "7 × 7 - Standard",
      "8 × 8 - Standard",
    ]);
    expect(gameApp?.getBoardSession().getGameState().remainingPieces).toEqual({
      black: 36,
      white: 36,
    });
    expect(root.querySelectorAll(".objective-target")).toHaveLength(16);
    expect(root.querySelector(".board-size-status")?.textContent).toBe("4 × 4");
    expect(root.querySelector(".turn-count")?.textContent).toBe("Turn 1 / 12");
  });

  test("starts a fresh game with the selected board and piece supply", () => {
    const { analytics, track } = createAnalyticsSpy();
    const root = createApp(analytics);

    startGame(root, "6x6");

    expect(gameApp?.getConfiguration().id).toBe("6x6");
    expect(gameApp?.getBoardSession().getGameState().remainingPieces).toEqual({
      black: 60,
      white: 60,
    });
    expect(root.querySelectorAll(".objective-target")).toHaveLength(36);
    expect(root.querySelectorAll(".supply-point-target")).toHaveLength(49);
    expect(root.querySelector(".board-size-status")?.textContent).toBe("6 × 6");
    expect(root.querySelector(".turn-count")?.textContent).toBe("Turn 1 / 20");
    expect(root.querySelector<HTMLDialogElement>(".new-game-dialog")?.open).toBe(false);
    expect(track).toHaveBeenCalledWith({
      name: "board_size_selected",
      parameters: { board_size: "6x6" },
    });
  });

  test("opens board selection in a modal and cancel preserves the game", () => {
    const root = createApp();
    const originalSession = gameApp?.getBoardSession();

    click(root, '[data-action="open-new-game"]');

    const dialog = root.querySelector<HTMLDialogElement>(".new-game-dialog");
    const select = root.querySelector<HTMLSelectElement>("#board-size");
    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector("h2")?.textContent).toBe("Choose a board size");
    expect(
      Array.from(dialog?.querySelectorAll("p") ?? []).map(
        (paragraph) => paragraph.textContent,
      ),
    ).toEqual(["4 × 4 and 7 × 7 are recommended."]);
    expect(dialog?.querySelector("label")).toBeNull();
    expect(select?.getAttribute("aria-label")).toBe("Board size");
    expect(select?.value).toBe("4x4");

    if (select) {
      select.value = "8x8";
    }
    click(root, '[data-action="cancel-new-game"]');

    expect(dialog?.open).toBe(false);
    expect(gameApp?.getConfiguration().id).toBe("4x4");
    expect(gameApp?.getBoardSession()).toBe(originalSession);
  });

  test("restart clears placements, pending support selection, and undo history", () => {
    const root = createApp();

    click(root, '.supply-point-target[data-row="1"][data-column="1"]');
    click(root, '.supply-point-target[data-row="1"][data-column="1"]');
    click(root, '.supply-point-target[data-row="2"][data-column="2"]');
    click(root, '.supply-point-target[data-row="3"][data-column="3"]');
    click(root, '.supply-point-target[data-row="3"][data-column="3"]');
    click(root, '.supply-point-target[data-row="3"][data-column="2"]');
    click(root, '.objective-target[data-row="0"][data-column="0"]');
    expect(gameApp?.getBoardSession().getPendingSupportSelection()).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>(".undo-button")?.disabled).toBe(false);

    startGame(root, "4x4");

    const state = gameApp?.getBoardSession().getGameState();
    expect(state?.remainingPieces).toEqual({ black: 36, white: 36 });
    expect(state?.turn.placements).toEqual([]);
    expect(gameApp?.getBoardSession().getPendingSupportSelection()).toBeNull();
    expect(root.querySelector<HTMLButtonElement>(".undo-button")?.disabled).toBe(true);
  });
});

describe("play analytics", () => {
  test("tracks game start once per game, including after New Game", () => {
    const { analytics, track } = createAnalyticsSpy();
    const root = createApp(analytics);
    const placement =
      '.supply-point-target[data-row="1"][data-column="1"]';

    click(root, placement);
    click(root, ".undo-button");
    click(root, placement);

    expect(track.mock.calls.filter(([event]) => event.name === "game_start"))
      .toEqual([
        [
          {
            name: "game_start",
            parameters: { board_size: "4x4" },
          },
        ],
      ]);

    startGame(root, "4x4");
    click(root, placement);

    expect(
      track.mock.calls.filter(([event]) => event.name === "game_start"),
    ).toHaveLength(2);
  });

  test("tracks successful undo with the active board size", () => {
    const { analytics, track } = createAnalyticsSpy();
    const root = createApp(analytics);

    click(root, '.supply-point-target[data-row="1"][data-column="1"]');
    click(root, ".undo-button");

    expect(track).toHaveBeenCalledWith({
      name: "undo",
      parameters: { board_size: "4x4" },
    });
  });

  test("tracks game completion with a coarse result", () => {
    const { analytics, track } = createAnalyticsSpy();
    const configuration: GameConfiguration = {
      id: "test-3x3",
      label: "3 × 3",
      category: "Prototype",
      cellsPerSide: 3,
      piecesPerPlayer: 3,
    };
    const root = createApp(analytics, configuration);

    click(root, '.supply-point-target[data-row="1"][data-column="1"]');
    click(root, '.supply-point-target[data-row="1"][data-column="1"]');
    click(root, '.supply-point-target[data-row="1"][data-column="2"]');
    click(root, '.supply-point-target[data-row="0"][data-column="0"]');
    click(root, '.supply-point-target[data-row="0"][data-column="0"]');
    click(root, '.supply-point-target[data-row="0"][data-column="1"]');

    expect(track).toHaveBeenCalledWith({
      name: "game_complete",
      parameters: {
        board_size: "test-3x3",
        result: "draw",
      },
    });
  });

  test("continues without Analytics and when tracking throws", () => {
    const rootWithoutAnalytics = createApp();

    expect(() =>
      click(
        rootWithoutAnalytics,
        '.supply-point-target[data-row="1"][data-column="1"]',
      ),
    ).not.toThrow();
    expect(gameApp?.getBoardSession().getGameState().remainingPieces.black)
      .toBe(35);

    gameApp?.disconnect();
    const throwingAnalytics: ProductAnalytics = {
      track: () => {
        throw new Error("Analytics unavailable");
      },
    };
    const rootWithFailure = createApp(throwingAnalytics);

    expect(() => startGame(rootWithFailure, "6x6")).not.toThrow();
    expect(gameApp?.getConfiguration().id).toBe("6x6");
  });
});
