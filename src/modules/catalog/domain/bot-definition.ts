export class BotDefinition {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly level: number,
    readonly maxHp: number,
    readonly strength: number,
  ) {}
}
