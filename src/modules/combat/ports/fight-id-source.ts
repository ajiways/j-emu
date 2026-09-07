export interface FightIdSource {
  nextFightId(): Promise<string>;
  nextParticipantId(): Promise<bigint>;
}
