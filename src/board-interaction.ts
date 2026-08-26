import {
  renderGameState,
  type BoardPresentationState,
} from "./board-renderer.ts";
import type { BoardCoordinate } from "./game/board-geometry.ts";
import type { GameState, PlacementTarget } from "./game/game-state.ts";
import { applyPlacement } from "./game/placement-application.ts";
import { evaluatePlacement } from "./game/placement-legality.ts";

type GameStateRenderer = (
  container: HTMLElement,
  state: GameState,
  presentation?: BoardPresentationState,
) => void;

type ObjectivePlacementTarget = PlacementTarget & {
  readonly kind: "objective";
};

export interface PendingSupportSelection {
  readonly objective: ObjectivePlacementTarget;
  readonly eligibleSupplyPoints: readonly BoardCoordinate[];
}

export interface BoardSession {
  readonly getGameState: () => GameState;
  readonly getPendingSupportSelection: () => PendingSupportSelection | null;
  readonly disconnect: () => void;
}

export interface BoardInteractionState {
  readonly gameState: GameState;
  readonly pendingSupportSelection: PendingSupportSelection | null;
}

function coordinatesMatch(
  first: BoardCoordinate,
  second: BoardCoordinate,
): boolean {
  return first.row === second.row && first.column === second.column;
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

/** Applies one resolved board interaction without depending on the DOM. */
export function processBoardInteraction(
  current: BoardInteractionState,
  target: PlacementTarget | null,
): BoardInteractionState {
  const { gameState, pendingSupportSelection } = current;

  if (pendingSupportSelection !== null) {
    const selectedSupplyPointIsEligible =
      target?.kind === "supply-point" &&
      pendingSupportSelection.eligibleSupplyPoints.some((coordinate) =>
        coordinatesMatch(coordinate, target),
      );

    if (!selectedSupplyPointIsEligible) {
      return {
        gameState,
        pendingSupportSelection: null,
      };
    }

    const result = applyPlacement(
      gameState,
      pendingSupportSelection.objective,
      { row: target.row, column: target.column },
    );

    return result.applied
      ? {
          gameState: result.state,
          pendingSupportSelection: null,
        }
      : current;
  }

  if (target === null) {
    return current;
  }

  const legality = evaluatePlacement(gameState, target);

  if (!legality.legal) {
    return current;
  }

  if (legality.kind === "objective") {
    return {
      gameState,
      pendingSupportSelection: {
        objective: {
          kind: "objective",
          row: target.row,
          column: target.column,
        },
        eligibleSupplyPoints: legality.eligibleSupplyPoints,
      },
    };
  }

  const result = applyPlacement(gameState, target);

  return result.applied
    ? {
        gameState: result.state,
        pendingSupportSelection: null,
      }
    : current;
}

/** Owns the current browser GameState and delegates clicks from the container. */
export function createBoardSession(
  container: HTMLElement,
  initialState: GameState,
  render: GameStateRenderer = renderGameState,
): BoardSession {
  let interactionState: BoardInteractionState = {
    gameState: initialState,
    pendingSupportSelection: null,
  };

  const renderCurrentState = (): void => {
    render(container, interactionState.gameState, {
      eligibleSupplyPoints:
        interactionState.pendingSupportSelection?.eligibleSupplyPoints,
    });
  };

  const handleClick = (event: MouseEvent): void => {
    const target = getPlacementTarget(event.target);
    const nextInteractionState = processBoardInteraction(
      interactionState,
      target,
    );

    if (nextInteractionState === interactionState) {
      return;
    }

    interactionState = nextInteractionState;
    renderCurrentState();
  };

  container.addEventListener("click", handleClick);
  renderCurrentState();

  return {
    getGameState: () => interactionState.gameState,
    getPendingSupportSelection: () =>
      interactionState.pendingSupportSelection,
    disconnect: () => container.removeEventListener("click", handleClick),
  };
}
