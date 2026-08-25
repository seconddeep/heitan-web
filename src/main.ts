import "./style.css";
import { renderBoard } from "./board-renderer.ts";
import { createBoardGeometry } from "./game/board-geometry.ts";

const boardSize = 4;
const geometry = createBoardGeometry(boardSize);
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root not found");
}

app.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <h1>Heitan</h1>
      <p>Current board: ${boardSize} × ${boardSize}</p>
    </header>
    <div class="board-container"></div>
  </main>
`;

const boardContainer = app.querySelector<HTMLDivElement>(".board-container");

if (!boardContainer) {
  throw new Error("Board container not found");
}

boardContainer.append(renderBoard(geometry));
