import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { FightDuel } from "./fight-duel.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { resolveRosterBotTurn } from "./hunt-bot-vs-bot.ts";
import { huntFightEnemyTeam, huntFightOpenerTeam } from "./hunt-fight-teams.ts";
import { HuntRosterBot } from "./hunt-roster-bot.ts";
import type { BotMeleePresence } from "./melee-target.ts";
import type { RandomSource } from "./random-source.ts";

export class HuntRoster {
  readonly openerTeam: 1 | 2;
  readonly enemyTeam: 1 | 2;
  readonly primary: HuntRosterBot;
  private readonly bots: HuntRosterBot[];
  private readonly extraDuels: FightDuel[] = [];
  private readonly waitingEnemies: HuntRosterBot[] = [];

  constructor(init: HuntBattleInit) {
    this.openerTeam = huntFightOpenerTeam(init.purpose);
    this.enemyTeam = huntFightEnemyTeam(init.purpose);
    this.primary = HuntRosterBot.fromSeed(
      {
        fightId: init.botFightId,
        artikulId: init.botArtikulId,
        nick: init.botNick,
        level: init.botLevel,
        hp: init.botMaxHp,
        strength: init.botStrength,
        initiative: init.botInitiative,
        magPower: init.botMagPower,
        magResist: init.botMagResist,
        avatar: init.botAvatar,
        sk: init.botSk,
        body: init.botBody,
        spellBook: init.botSpellBook,
      },
      this.enemyTeam,
    );
    const extraEnemies = init.extraEnemies.map((seed) =>
      HuntRosterBot.fromSeed(seed, this.enemyTeam),
    );
    const allies = init.allies.map((seed) => HuntRosterBot.fromSeed(seed, this.openerTeam));
    this.bots = [this.primary, ...extraEnemies, ...allies];
    const seen = new Set<number>([init.heroId]);
    for (const bot of this.bots) {
      if (seen.has(bot.fightId)) {
        throw new Error(`Roster bot fight id ${bot.fightId} collides`);
      }
      seen.add(bot.fightId);
    }
    const leftoverEnemies = [...extraEnemies];
    const leftoverAllies = [...allies];
    while (leftoverEnemies.length > 0 && leftoverAllies.length > 0) {
      const enemy = leftoverEnemies.shift();
      const ally = leftoverAllies.shift();
      if (!enemy || !ally) throw new Error("Quest roster pairing is missing a bot");
      this.extraDuels.push(new FightDuel(ally.fightId, enemy.fightId, ally.fightId));
    }
    this.waitingEnemies.push(...leftoverEnemies);
  }

  snaps(): readonly HuntBotSnap[] {
    return this.bots.map((bot) => bot.snap());
  }

  presences(): readonly BotMeleePresence[] {
    return this.bots.map((bot) => bot.presence());
  }

  applyPresence(hit: BotMeleePresence): void {
    this.requireBot(hit.fightId).setHp(hit.hp);
  }

  enemySideCleared(): boolean {
    return this.bots.filter((bot) => bot.team === this.enemyTeam).every((bot) => bot.hp === 0);
  }

  skipQuestKills(): boolean {
    return this.openerTeam === 2 && this.bots.length > 1;
  }

  bot(fightId: number): HuntRosterBot {
    return this.requireBot(fightId);
  }

  findBot(fightId: number): HuntRosterBot | null {
    return this.bots.find((entry) => entry.fightId === fightId) ?? null;
  }

  takeNextEnemyForHuman(occupiedFightId: number): HuntRosterBot | null {
    const waiting = this.waitingEnemies.find((bot) => bot.hp > 0);
    if (waiting) {
      this.waitingEnemies.splice(this.waitingEnemies.indexOf(waiting), 1);
      return waiting;
    }
    for (let index = this.extraDuels.length - 1; index >= 0; index -= 1) {
      const duel = this.extraDuels[index];
      if (!duel) continue;
      const enemy = this.livingEnemyIn(duel);
      if (!enemy || enemy.fightId === occupiedFightId) continue;
      this.dissolve(index, enemy.fightId);
      return enemy;
    }
    return null;
  }

  extraDuelParticipantIds(): readonly number[] {
    const ids: number[] = [];
    for (const duel of this.extraDuels) {
      ids.push(duel.aId, duel.bId);
    }
    return ids;
  }

  unpairedLiving(occupied: ReadonlySet<number>): readonly HuntRosterBot[] {
    return this.bots.filter((bot) => bot.hp > 0 && !occupied.has(bot.fightId));
  }

  addExtraDuel(duel: FightDuel): void {
    this.extraDuels.push(duel);
  }

  enqueueAggroClone(sourceFightId: number, cloneFightId: number): HuntRosterBot {
    const source = this.requireBot(sourceFightId);
    if (source.team !== this.enemyTeam) {
      throw new Error("Aggro clone source must be an enemy bot");
    }
    const clone = source.cloneWithFightId(cloneFightId);
    if (this.bots.some((bot) => bot.fightId === clone.fightId)) {
      throw new Error(`Roster bot fight id ${clone.fightId} collides`);
    }
    this.bots.push(clone);
    return clone;
  }

  tick(rules: BattleRules, random: RandomSource, fightId: string): readonly BattleEvent[] {
    void fightId;
    const events: BattleEvent[] = [];
    for (let index = this.extraDuels.length - 1; index >= 0; index -= 1) {
      const duel = this.extraDuels[index];
      if (!duel) continue;
      const actor = this.requireBot(duel.nextActorId);
      const target = this.requireBot(duel.otherId(actor.fightId));
      if (actor.hp === 0 || target.hp === 0) {
        this.dissolve(index, null);
        continue;
      }
      events.push(...resolveRosterBotTurn(actor, target, { rules, random }));
      duel.addHit(actor.fightId);
      if (target.hp > 0) duel.setNextActor(target.fightId);
      if (actor.hp === 0 || target.hp === 0) this.dissolve(index, null);
    }
    return events;
  }

  private livingEnemyIn(duel: FightDuel): HuntRosterBot | null {
    for (const id of [duel.aId, duel.bId]) {
      const bot = this.requireBot(id);
      if (bot.team === this.enemyTeam && bot.hp > 0) return bot;
    }
    return null;
  }

  private dissolve(index: number, keepFightId: number | null): void {
    const duel = this.extraDuels[index];
    if (!duel) throw new Error("Quest roster extra duel is missing");
    this.extraDuels.splice(index, 1);
    for (const id of [duel.aId, duel.bId]) {
      if (id === keepFightId) continue;
      const bot = this.requireBot(id);
      if (bot.team === this.enemyTeam && bot.hp > 0) this.waitingEnemies.push(bot);
    }
  }

  private requireBot(fightId: number): HuntRosterBot {
    const bot = this.bots.find((entry) => entry.fightId === fightId);
    if (!bot) throw new Error(`Roster bot ${fightId} is missing`);
    return bot;
  }
}
