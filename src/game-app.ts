import { createBoardSession, type BoardSession } from "./board-interaction.ts";
import { renderGameState } from "./board-renderer.ts";
import {
  defaultGameConfiguration,
  supportedGameConfigurations,
  type GameConfiguration,
} from "./game-configuration.ts";
import { createInitialGameState } from "./game/game-state.ts";

export interface GameApp {
  readonly getConfiguration: () => GameConfiguration;
  readonly getBoardSession: () => BoardSession;
  readonly disconnect: () => void;
}

export function createGameApp(
  app: HTMLElement,
  configurations: readonly GameConfiguration[] = supportedGameConfigurations,
  initialConfiguration: GameConfiguration = defaultGameConfiguration,
): GameApp {
  if (configurations.length === 0) {
    throw new RangeError("At least one game configuration is required");
  }

  if (!configurations.includes(initialConfiguration)) {
    throw new RangeError("Initial configuration must be supported");
  }

  app.innerHTML = `
    <main class="app-shell">
      <nav class="app-navigation" aria-label="Game">
        <button
          class="app-navigation-item new-game-button"
          type="button"
          aria-haspopup="dialog"
          data-action="open-new-game"
        >New Game</button>
        <a
          class="app-navigation-item rules-link"
          href="https://github.com/seconddeep/heitan-ludii/blob/main/docs/rules.md"
          target="_blank"
          rel="noopener noreferrer"
        >Rules</a>
      </nav>
      <header class="app-header">
        <h1>Heitan</h1>
        <p class="current-board"></p>
      </header>
      <div class="board-container"></div>
      <dialog class="new-game-dialog" aria-labelledby="new-game-title">
        <form class="new-game-form">
          <h2 id="new-game-title">Start a new game</h2>
          <p>Choose a board size.</p>
          <select
            id="board-size"
            name="board-size"
            aria-label="Board size"
          ></select>
          <div class="new-game-dialog-actions">
            <button type="button" data-action="cancel-new-game">Cancel</button>
            <button type="submit">Start</button>
          </div>
        </form>
      </dialog>
    </main>
  `;

  const openButton = app.querySelector<HTMLButtonElement>(
    '[data-action="open-new-game"]',
  );
  const dialog = app.querySelector<HTMLDialogElement>(".new-game-dialog");
  const form = app.querySelector<HTMLFormElement>(".new-game-form");
  const select = app.querySelector<HTMLSelectElement>("#board-size");
  const cancelButton = app.querySelector<HTMLButtonElement>(
    '[data-action="cancel-new-game"]',
  );
  const currentBoard = app.querySelector<HTMLElement>(".current-board");
  const boardContainer = app.querySelector<HTMLElement>(".board-container");

  if (
    !openButton ||
    !dialog ||
    !form ||
    !select ||
    !cancelButton ||
    !currentBoard ||
    !boardContainer
  ) {
    throw new Error("Game application controls could not be created");
  }

  for (const configuration of configurations) {
    const option = document.createElement("option");
    option.value = configuration.id;
    option.textContent = `${configuration.label} - ${configuration.piecesPerPlayer} pieces`;
    select.append(option);
  }

  let activeConfiguration = initialConfiguration;
  let boardSession: BoardSession;

  const startGame = (configuration: GameConfiguration): void => {
    activeConfiguration = configuration;
    select.value = configuration.id;
    currentBoard.textContent = `Current board: ${configuration.label}`;
    boardSession?.disconnect();
    boardSession = createBoardSession(
      boardContainer,
      createInitialGameState(
        configuration.cellsPerSide,
        configuration.piecesPerPlayer,
      ),
      (container, state, presentation) =>
        renderGameState(container, state, presentation, configuration),
    );
  };

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const selectedConfiguration = configurations.find(
      (configuration) => configuration.id === select.value,
    );

    if (selectedConfiguration !== undefined) {
      startGame(selectedConfiguration);
      closeDialog();
    }
  };

  const openDialog = (): void => {
    select.value = activeConfiguration.id;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  };

  const closeDialog = (): void => {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  };

  openButton.addEventListener("click", openDialog);
  cancelButton.addEventListener("click", closeDialog);
  form.addEventListener("submit", handleSubmit);
  startGame(initialConfiguration);

  return {
    getConfiguration: () => activeConfiguration,
    getBoardSession: () => boardSession,
    disconnect: () => {
      openButton.removeEventListener("click", openDialog);
      cancelButton.removeEventListener("click", closeDialog);
      form.removeEventListener("submit", handleSubmit);
      boardSession.disconnect();
    },
  };
}
