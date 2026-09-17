import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { HuntBotSnap } from "./battle-event.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { HuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import { requireHuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import { HuntHumanFightEffects } from "./hunt-human-fight-effects.ts";
import type { MagStats } from "./mag-stats.ts";
import type { SchoolOverlay } from "./school-overlay.ts";
import type { BotMeleePresence } from "./melee-target.ts";

export type HuntRosterBotSeed = Readonly<{
  fightId: number;
  artikulId: number;
  nick: string;
  level: number;
  hp: number;
  strength: number;
  initiative: number;
  magPower: number;
  magResist: number;
  avatar: string;
  sk: string;
  body: string;
  spellBook: HuntBotSpellBook;
}>;

export class HuntRosterBot {
  private hpValue: number;
  private dealtDamageValue = 0;
  private lastOpponentIdValue: number | null = null;
  readonly casts = new Map<number, number>();
  schoolOverlay: SchoolOverlay | null = null;
  stunnedTurns = 0;
  readonly effects: HuntHumanFightEffects;

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
    readonly initiative: number,
    readonly magPower: number,
    readonly magResist: number,
    readonly maxHp: number,
    readonly spellBook: HuntBotSpellBook,
    hp: number,
    effectIds: FightEffectIds,
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
    if (!Number.isInteger(initiative) || initiative < 0) {
      throw new Error("Roster bot initiative must be a non-negative integer");
    }
    if (!Number.isInteger(magPower) || magPower < 0) {
      throw new Error("Roster bot mag power must be a non-negative integer");
    }
    if (!Number.isInteger(magResist) || magResist < 0) {
      throw new Error("Roster bot mag resist must be a non-negative integer");
    }
    if (!Number.isInteger(maxHp) || maxHp < 1) throw new Error("Roster bot maxHp is invalid");
    if (!Number.isInteger(hp) || hp < 0 || hp > maxHp) {
      throw new Error("Roster bot hp is invalid");
    }
    requireHuntBotSpellBook(spellBook);
    this.hpValue = hp;
    this.effects = new HuntHumanFightEffects({
      heroId: fightId,
      strength,
      startedAtMs: 0,
      gearSpells: [],
      effectIds,
    });
  }

  static fromSeed(seed: HuntRosterBotSeed, team: 1 | 2, effectIds: FightEffectIds): HuntRosterBot {
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
      seed.initiative,
      seed.magPower,
      seed.magResist,
      seed.hp,
      seed.spellBook,
      seed.hp,
      effectIds,
    );
  }

  get hp(): number {
    return this.hpValue;
  }

  get dealtDamage(): number {
    return this.dealtDamageValue;
  }

  get lastOpponentId(): number | null {
    return this.lastOpponentIdValue;
  }

  get mag(): MagStats {
    return { power: this.magPower, resist: this.magResist };
  }

  markFought(opponentId: number): void {
    if (!Number.isInteger(opponentId) || opponentId < 1) {
      throw new Error("Last opponent id must be a positive integer");
    }
    this.lastOpponentIdValue = opponentId;
  }

  cloneWithFightId(fightId: number): HuntRosterBot {
    return new HuntRosterBot(
      fightId,
      this.artikulId,
      this.nick,
      this.level,
      this.avatar,
      this.sk,
      this.body,
      this.team,
      this.strength,
      this.initiative,
      this.magPower,
      this.magResist,
      this.maxHp,
      this.spellBook,
      this.maxHp,
      this.effects.effectIds,
    );
  }

  applyDamage(damage: number): boolean {
    if (!Number.isInteger(damage) || damage < 1) {
      throw new Error("Melee damage must be a positive integer");
    }
    this.hpValue = Math.max(0, this.hpValue - damage);
    return this.hpValue === 0;
  }

  creditDealtDamage(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Roster bot dealt damage must be a non-negative integer");
    }
    this.dealtDamageValue += amount;
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
      strength: this.strength,
      mag: this.mag,
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
      dealtDamage: this.dealtDamageValue,
    };
  }
}
