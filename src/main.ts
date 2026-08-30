import "./style.css";
import { createFirebaseProductAnalytics } from "./analytics.ts";
import { createGameApp } from "./game-app.ts";
import {
  defaultGameConfiguration,
  supportedGameConfigurations,
} from "./game-configuration.ts";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root not found");
}

createGameApp(
  app,
  supportedGameConfigurations,
  defaultGameConfiguration,
  createFirebaseProductAnalytics(),
);
