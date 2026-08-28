import "./style.css";
import { createGameApp } from "./game-app.ts";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root not found");
}

createGameApp(app);
