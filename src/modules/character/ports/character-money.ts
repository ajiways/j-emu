export type CreditMoneyCommand = Readonly<{
  characterId: number;
  minorUnits: number;
}>;

export interface CharacterMoney {
  creditMoney(command: CreditMoneyCommand): Promise<void>;
}
