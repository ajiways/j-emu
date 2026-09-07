export interface FightIdSource {
  nextFightId(): Promise<string>;
}
