export type CreditMoneyCommand = Readonly<{
  characterId: number;
  minorUnits: number;
}>;

export type DebitMoneyCommand = Readonly<{
  characterId: number;
  minorUnits: number;
  allowGhost: boolean;
}>;

export interface CharacterMoney {
  creditMoney(command: CreditMoneyCommand): Promise<void>;
  debitMoney(command: DebitMoneyCommand): Promise<void>;
}
