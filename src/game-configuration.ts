export interface GameConfiguration {
  readonly id: string;
  readonly label: string;
  readonly cellsPerSide: number;
  readonly piecesPerPlayer: number;
}

// Browser-play configurations recorded in heitan-web issue #57.
export const supportedGameConfigurations: readonly GameConfiguration[] = [
  { id: "3x3", label: "3 × 3", cellsPerSide: 3, piecesPerPlayer: 27 },
  { id: "4x4", label: "4 × 4", cellsPerSide: 4, piecesPerPlayer: 36 },
  { id: "5x5", label: "5 × 5", cellsPerSide: 5, piecesPerPlayer: 48 },
  { id: "6x6", label: "6 × 6", cellsPerSide: 6, piecesPerPlayer: 60 },
  { id: "7x7", label: "7 × 7", cellsPerSide: 7, piecesPerPlayer: 72 },
  { id: "8x8", label: "8 × 8", cellsPerSide: 8, piecesPerPlayer: 84 },
] as const;

export const defaultGameConfiguration = supportedGameConfigurations[1];

export function getTotalTurnCount(
  configuration: GameConfiguration,
): number {
  return Math.ceil((configuration.piecesPerPlayer * 2) / 3);
}
