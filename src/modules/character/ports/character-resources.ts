export type SyncResourcesCommand = Readonly<{
  characterId: number;
}>;

export type NoteHpCommand = Readonly<{
  characterId: number;
  hp: number;
}>;

export type ResourceSnapshot = Readonly<{
  characterId: number;
  hp: number;
  maxHp: number;
  hpTime: number;
  regenAt: Date;
  inActiveFight: boolean;
  persisted: boolean;
}>;

export interface CharacterResources {
  syncResources(command: SyncResourcesCommand): Promise<ResourceSnapshot>;
  noteHp(command: NoteHpCommand): Promise<ResourceSnapshot>;
}
