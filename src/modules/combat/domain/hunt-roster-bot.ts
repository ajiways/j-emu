import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { HuntBotSnap } from "./battle-event.ts";
import type { HuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import { requireHuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import type { BotMeleePresence } from "./melee-target.ts";

export type HuntRosterBotSeed = Readonly<{
  fightId: number;
  artikulId: number;
  nick: string;
  level: number;
  hp: number;
  strength: number;
  avatar: string;
  sk: string;
  body: string;
  spellBook: HuntBotSpellBook;
}>;

export class HuntRosterBot {
  private hpValue: number;
  readonly casts = new Map<number, number>();

  constructor(
    readonly fightId: number,
    readonly artikulId: number,
    readonly nick: string,
    readonly level: number,
    readonly avatar: string,
    readonly sk: string,
    readonly body: string,
    readonly team: 1 | 2,
    readonly strength: number,
    readonly maxHp: number,
    readonly spellBook: HuntBotSpellBook,
    hp: number,
  ) {
    requireWireIdentity(fightId, "roster bot fight id");
    requireWireIdentity(artikulId, "roster bot artikul id");
    if (fightId < 1_000_000) throw new Error("Fight bot id is below the ephemeral floor");
    if (!nick) throw new Error("Roster bot nick is required");
    if (!Number.isInteger(level) || level < 1) throw new Error("Roster bot level must be positive");
    if (!avatar) throw new Error("Roster bot avatar is required");
    if (!sk) throw new Error("Roster bot sk is required");
    if (typeof body !== "string") throw new Error("Roster bot body is required");
    if (!Number.isInteger(strength) || strength < 1) {
      throw new Error("Roster bot strength must be positive");
    }
    if (!Number.isInteger(maxHp) || maxHp < 1) throw new Error("Roster bot maxHp is invalid");
    if (!Number.isInteger(hp) || hp < 0 || hp > maxHp) {
      throw new Error("Roster bot hp is invalid");
    }
    requireHuntBotSpellBook(spellBook);
    this.hpValue = hp;
  }

  static fromSeed(seed: HuntRosterBotSeed, team: 1 | 2): HuntRosterBot {
    return new HuntRosterBot(
      seed.fightId,
      seed.artikulId,
      seed.nick,
      seed.level,
      seed.avatar,
      seed.sk,
      seed.body,
      team,
      seed.strength,
      seed.hp,
      seed.spellBook,
      seed.hp,
    );
  }

  get hp(): number {
    return this.hpValue;
  }

  applyDamage(damage: number): boolean {
    if (!Number.isInteger(damage) || damage < 1) {
      throw new Error("Melee damage must be a positive integer");
    }
    this.hpValue = Math.max(0, this.hpValue - damage);
    return this.hpValue === 0;
  }

  setHp(hp: number): void {
    if (!Number.isInteger(hp) || hp < 0 || hp > this.maxHp) {
      throw new Error("Roster bot hp is invalid");
    }
    this.hpValue = hp;
  }

  presence(): BotMeleePresence {
    return {
      fightId: this.fightId,
      hp: this.hpValue,
      maxHp: this.maxHp,
      team: this.team,
    };
  }

  snap(): HuntBotSnap {
    return {
      id: this.fightId,
      nick: this.nick,
      level: this.level,
      hp: this.hpValue,
      maxHp: this.maxHp,
      artikulId: this.artikulId,
      avatar: this.avatar,
      sk: this.sk,
      body: this.body,
      team: this.team,
    };
  }
}
