import {
  renderGameState,
  type BoardPresentationState,
} from "./board-renderer.ts";
import type { BoardCoordinate } from "./game/board-geometry.ts";
import { isGameOver } from "./game/game-end.ts";
import type { GameState, PlacementTarget } from "./game/game-state.ts";
import {
  applyObjectivePlacement,
  applySupplyPointPlacement,
} from "./game/placement-application.ts";
import {
  evaluateObjectivePlacement,
  evaluateSupplyPointPlacement,
} from "./game/placement-legality.ts";
import { completeTurn } from "./game/turn-completion.ts";

type GameStateRenderer = (
  container: HTMLElement,
  state: GameState,
  presentation?: BoardPresentationState,
) => void;

export interface PendingSupportSelection {
  readonly objective: BoardCoordinate;
  readonly eligibleSupplyPoints: readonly BoardCoordinate[];
}

export interface BoardSession {
  readonly getGameState: () => GameState;
  readonly getPendingSupportSelection: () => PendingSupportSelection | null;
  readonly disconnect: () => void;
}

interface BoardInteractionState {
  readonly gameState: GameState;
  readonly pendingSupportSelection: PendingSupportSelection | null;
}

function processSupplySelection(
  current: BoardInteractionState,
  coordinate: BoardCoordinate,
): BoardInteractionState {
  const legality = evaluateSupplyPointPlacement(
    current.gameState,
    coordinate,
  );

  return legality.legal
    ? {
        gameState: applySupplyPointPlacement(
          current.gameState,
          coordinate,
        ),
        pendingSupportSelection: null,
      }
    : current;
}

function processObjectiveSelection(
  current: BoardInteractionState,
  coordinate: BoardCoordinate,
): BoardInteractionState {
  const legality = evaluateObjectivePlacement(current.gameState, coordinate);

  return legality.legal
    ? {
        gameState: current.gameState,
        pendingSupportSelection: {
          objective: { ...coordinate },
          eligibleSupplyPoints: legality.eligibleSupplyPoints,
        },
      }
    : current;
}

function processObjectiveSupportSelection(
  current: BoardInteractionState,
  pendingSupportSelection: PendingSupportSelection,
  target: PlacementTarget | null,
): BoardInteractionState {
  const selectedSupplyPointIsEligible =
    target?.kind === "supply-point" &&
    pendingSupportSelection.eligibleSupplyPoints.some((coordinate) =>
      coordinatesMatch(coordinate, target),
    );

  if (!selectedSupplyPointIsEligible) {
    return {
      gameState: current.gameState,
      pendingSupportSelection: null,
    };
  }

  return {
    gameState: applyObjectivePlacement(
      current.gameState,
      pendingSupportSelection.objective,
      { row: target.row, column: target.column },
    ),
    pendingSupportSelection: null,
  };
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

function completeTurnAfterThirdPlacement(state: GameState): GameState {
  if (state.turn.placements.length !== 3) {
    return state;
  }

  return completeTurn(state);
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
    if (isGameOver(interactionState.gameState)) {
      return;
    }

    const target = getPlacementTarget(event.target);
    let nextInteractionState = interactionState;

    if (interactionState.pendingSupportSelection !== null) {
      nextInteractionState = processObjectiveSupportSelection(
        interactionState,
        interactionState.pendingSupportSelection,
        target,
      );
    } else if (target?.kind === "supply-point") {
      nextInteractionState = processSupplySelection(interactionState, target);
    } else if (target?.kind === "objective") {
      nextInteractionState = processObjectiveSelection(
        interactionState,
        target,
      );
    }

    if (nextInteractionState !== interactionState) {
      interactionState = {
        ...nextInteractionState,
        gameState: completeTurnAfterThirdPlacement(
          nextInteractionState.gameState,
        ),
      };
      renderCurrentState();
    }
  };

  container.addEventListener("click", handleClick);
  renderCurrentState();

  return {
    getGameState: () => interactionState.gameState,
    getPendingSupportSelection: () => interactionState.pendingSupportSelection,
    disconnect: () => container.removeEventListener("click", handleClick),
  };
}
