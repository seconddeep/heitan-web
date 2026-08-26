import "./style.css";
import { renderGameState } from "./board-renderer.ts";
import { createInitialGameState } from "./game/game-state.ts";

// Matches the canonical 4x4 option in heitan-ludii/games/Heitan.lud.
const boardConfiguration = {
  cellsPerSide: 4,
  piecesPerPlayer: 36,
} as const;
const initialState = createInitialGameState(
  boardConfiguration.cellsPerSide,
  boardConfiguration.piecesPerPlayer,
);
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root not found");
}

app.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <h1>Heitan</h1>
      <p>Current board: ${boardConfiguration.cellsPerSide} × ${boardConfiguration.cellsPerSide}</p>
    </header>
    <div class="board-container"></div>
  </main>
`;

const boardContainer = app.querySelector<HTMLDivElement>(".board-container");

if (!boardContainer) {
  throw new Error("Board container not found");
}

renderGameState(boardContainer, initialState);
