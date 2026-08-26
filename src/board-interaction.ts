import { renderGameState } from "./board-renderer.ts";
import type { GameState, PlacementTarget } from "./game/game-state.ts";
import {
  applyPlacement,
  type PlacementApplicationResult,
} from "./game/placement-application.ts";
import { evaluatePlacement } from "./game/placement-legality.ts";

type GameStateRenderer = (container: HTMLElement, state: GameState) => void;

export interface BoardSession {
  readonly getGameState: () => GameState;
  readonly disconnect: () => void;
}

function parseCoordinate(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const coordinate = Number(value);

  return Number.isSafeInteger(coordinate) ? coordinate : null;
}

export function getPlacementTarget(
  eventTarget: EventTarget | null,
): PlacementTarget | null {
  if (
    !(eventTarget instanceof HTMLElement) &&
    !(eventTarget instanceof SVGElement)
  ) {
    return null;
  }

  const isSupplyPoint = eventTarget.matches(".supply-point-target");
  const isObjective = eventTarget.matches(".objective-target");

  if (!isSupplyPoint && !isObjective) {
    return null;
  }

  const expectedKind = isSupplyPoint ? "supply-point" : "objective";

  if (eventTarget.dataset.kind !== expectedKind) {
    return null;
  }

  const row = parseCoordinate(eventTarget.dataset.row);
  const column = parseCoordinate(eventTarget.dataset.column);

  if (row === null || column === null) {
    return null;
  }

  return { kind: expectedKind, row, column };
}

/** Owns the current browser GameState and delegates clicks from the container. */
export function createBoardSession(
  container: HTMLElement,
  initialState: GameState,
  render: GameStateRenderer = renderGameState,
): BoardSession {
  let gameState = initialState;

  const handleClick = (event: MouseEvent): void => {
    const target = getPlacementTarget(event.target);

    if (target === null) {
      return;
    }

    const legality = evaluatePlacement(gameState, target);

    if (!legality.legal) {
      return;
    }

    let result: PlacementApplicationResult;

    if (legality.kind === "supply-point") {
      result = applyPlacement(gameState, target);
    } else {
      if (legality.eligibleSupplyPoints.length !== 1) {
        return;
      }

      result = applyPlacement(
        gameState,
        target,
        legality.eligibleSupplyPoints[0],
      );
    }

    if (result?.applied !== true) {
      return;
    }

    gameState = result.state;
    render(container, gameState);
  };

  container.addEventListener("click", handleClick);
  render(container, gameState);

  return {
    getGameState: () => gameState,
    disconnect: () => container.removeEventListener("click", handleClick),
  };
}
