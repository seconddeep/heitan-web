// @vitest-environment happy-dom

import { afterEach, describe, expect, test } from "vitest";

import { createGameApp, type GameApp } from "../src/game-app.ts";

let gameApp: GameApp | undefined;

afterEach(() => {
  gameApp?.disconnect();
  gameApp = undefined;
  document.body.replaceChildren();
});

function createApp(): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  gameApp = createGameApp(root);
  return root;
}

function click(root: HTMLElement, selector: string): void {
  const target = root.querySelector(selector);
  if (!(target instanceof Element)) {
    throw new Error(`Missing target: ${selector}`);
  }
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

describe("new-game flow", () => {
  test("starts with the canonical 4 × 4 configuration", () => {
    const root = createApp();

    expect(gameApp?.getConfiguration().id).toBe("4x4");
    expect(
      root.querySelector<HTMLOptionElement>('#board-size option[value="4x4"]')
        ?.textContent,
    ).toBe("4 × 4 - 36 pieces");
    expect(
      root.querySelector<HTMLOptionElement>('#board-size option[value="6x6"]')
        ?.textContent,
    ).toBe("6 × 6 - 60 pieces");
    expect(gameApp?.getBoardSession().getGameState().remainingPieces).toEqual({
      black: 36,
      white: 36,
    });
    expect(root.querySelectorAll(".objective-target")).toHaveLength(16);
    expect(root.querySelector(".turn-count")?.textContent).toBe("Turn: 1 / 24");
  });

  test("starts a fresh game with the selected board and piece supply", () => {
    const root = createApp();

    startGame(root, "6x6");

    expect(gameApp?.getConfiguration().id).toBe("6x6");
    expect(gameApp?.getBoardSession().getGameState().remainingPieces).toEqual({
      black: 60,
      white: 60,
    });
    expect(root.querySelectorAll(".objective-target")).toHaveLength(36);
    expect(root.querySelectorAll(".supply-point-target")).toHaveLength(49);
    expect(root.querySelector(".turn-count")?.textContent).toBe("Turn: 1 / 40");
    expect(root.querySelector<HTMLDialogElement>(".new-game-dialog")?.open).toBe(false);
  });

  test("opens board selection in a modal and cancel preserves the game", () => {
    const root = createApp();
    const originalSession = gameApp?.getBoardSession();

    click(root, '[data-action="open-new-game"]');

    const dialog = root.querySelector<HTMLDialogElement>(".new-game-dialog");
    const select = root.querySelector<HTMLSelectElement>("#board-size");
    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector("h2")?.textContent).toBe("Start a new game");
    expect(dialog?.querySelector("p")?.textContent).toBe("Choose a board size.");
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
