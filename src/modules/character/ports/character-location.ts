export type SetAreaCommand = Readonly<{
  characterId: number;
  areaId: string;
  moveReadyAt: Date | null;
}>;

export interface CharacterLocation {
  setArea(command: SetAreaCommand): Promise<void>;
}
