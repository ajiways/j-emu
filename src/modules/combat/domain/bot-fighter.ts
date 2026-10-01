import type { BotBrain } from "./bot-brain.ts";
import { SpellBookBotBrain } from "./spell-book-bot-brain.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { BotSnap } from "./battle-event.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { MobSpellBook } from "./mob-spell-book.ts";
import { requireMobSpellBook } from "./mob-spell-book.ts";
import { EMPTY_COMBAT_LOADOUT } from "./combat-loadout.ts";
import type { FighterKind } from "./fighter.ts";
import { Participant, type ParticipantInit } from "./participant.ts";

export type BotFighterSeed = Readonly<{
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
  spellBook: MobSpellBook;
}>;

export class BotFighter extends Participant {
  readonly brain: BotBrain;
  /** Called into the fight by a summon (an idol): nobody may anger it into a clone. */
  summoned = false;

  constructor(
    readonly fightId: number,
    readonly artikulId: number,
    nick: string,
    level: number,
    readonly avatar: string,
    readonly sk: string,
    readonly body: string,
    team: 1 | 2,
    strength: number,
    initiative: number,
    magPower: number,
    magResist: number,
    private readonly baseMaxHp: number,
    readonly spellBook: MobSpellBook,
    hp: number,
    effectIds: FightEffectIds,
  ) {
    super(
      botParticipantInit(fightId, artikulId, {
        nick,
        level,
        avatar,
        sk,
        body,
        team,
        strength,
        initiative,
        magPower,
        magResist,
        baseMaxHp,
        spellBook,
        hp,
        effectIds,
      }),
    );
    this.brain = new SpellBookBotBrain(spellBook);
  }

  static fromSeed(seed: BotFighterSeed, team: 1 | 2, effectIds: FightEffectIds): BotFighter {
    return new BotFighter(
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

  get fighterKind(): FighterKind {
    return "bot";
  }

  get magPower(): number {
    return this.init.magPower;
  }

  get magResist(): number {
    return this.init.magResist;
  }

  cloneWithFightId(fightId: number): BotFighter {
    return new BotFighter(
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
      this.baseMaxHp,
      this.spellBook,
      this.baseMaxHp,
      this.effects.effectIds,
    );
  }

  snap(): BotSnap {
    return {
      id: this.fightId,
      nick: this.nick,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      artikulId: this.artikulId,
      avatar: this.avatar,
      sk: this.sk,
      body: this.body,
      team: this.team,
      dealtDamage: this.dealtDamage,
    };
  }
}

type BotParticipantFields = Readonly<{
  nick: string;
  level: number;
  avatar: string;
  sk: string;
  body: string;
  team: 1 | 2;
  strength: number;
  initiative: number;
  magPower: number;
  magResist: number;
  baseMaxHp: number;
  spellBook: MobSpellBook;
  hp: number;
  effectIds: FightEffectIds;
}>;

/** A mob has a strength and hit points of its own; its other stats and its kit come from effects. */
function botParticipantInit(
  fightId: number,
  artikulId: number,
  bot: BotParticipantFields,
): ParticipantInit {
  requireWireIdentity(fightId, "roster bot fight id");
  requireWireIdentity(artikulId, "roster bot artikul id");
  if (fightId < 1_000_000) throw new Error("Fight bot id is below the ephemeral floor");
  if (!bot.avatar) throw new Error("Roster bot avatar is required");
  if (!bot.sk) throw new Error("Roster bot sk is required");
  if (typeof bot.body !== "string") throw new Error("Roster bot body is required");
  requireMobSpellBook(bot.spellBook);
  return {
    id: fightId,
    nick: bot.nick,
    level: bot.level,
    team: bot.team,
    waiting: false,
    hp: bot.hp,
    maxHp: bot.baseMaxHp,
    mp: 0,
    maxMp: 0,
    strength: bot.strength,
    initiative: bot.initiative,
    rage: 0,
    dexterity: 0,
    defense: 0,
    block: 0,
    aggroCharges: 0,
    magPower: bot.magPower,
    magResist: bot.magResist,
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    effectIds: bot.effectIds,
  };
}
