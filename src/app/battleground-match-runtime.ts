import type { FightFinishedNotice } from "../modules/combat/ports/fight-terminal-observer.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { BattlegroundMatches } from "../modules/battleground/application/battleground-matches.ts";
import type {
  BattlegroundQueue,
  QueueHero,
} from "../modules/battleground/application/battleground-queue.ts";
import {
  FINISH_AFTER_FIGHT_MS,
  KIND_COHORT,
  KIND_LEAGUE,
  isBattlegroundRoom,
  type BattlegroundDefinition,
} from "../modules/battleground/domain/battleground-definition.ts";
import { bgStatsPayload } from "../modules/battleground/domain/battleground-wire.ts";
import type { BattlegroundHistory } from "../modules/battleground/ports/battleground-history.ts";
import { ProtocolError } from "../modules/jugger-wire/application/protocol-error.ts";
import type { FightWireMapper } from "../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { BattlegroundChrome, type BattlegroundChromeDeps } from "./battleground-chrome.ts";

export type BattlegroundMatchRuntimeDeps = BattlegroundChromeDeps &
  Readonly<{
    queue: BattlegroundQueue;
    matches: BattlegroundMatches;
    history: BattlegroundHistory;
    instances: InstanceService;
    fightWire: FightWireMapper;
    delay: DelayScheduler;
    chat: ChatDesk;
  }>;

export class BattlegroundMatchRuntime {
  private readonly chrome: BattlegroundChrome;

  constructor(private readonly deps: BattlegroundMatchRuntimeDeps) {
    this.chrome = new BattlegroundChrome(deps);
  }

  async startMatch(a: QueueHero, b: QueueHero): Promise<void> {
    const leagueBefore = await this.chrome.requireHeroById(a.heroId);
    const cohortBefore = await this.chrome.requireHeroById(b.heroId);
    const copy = await this.deps.unitOfWork.run(async () => {
      const created = await this.deps.instances.createBgCopy(
        this.deps.definition.instArtikulId,
        this.deps.definition.matchDurationSec,
      );
      await this.chrome.teleportSide(a.heroId, KIND_LEAGUE, created.id);
      await this.chrome.teleportSide(b.heroId, KIND_COHORT, created.id);
      return created;
    });
    const timeStart = this.deps.clock.unixSeconds();
    const [leagueHero, cohortHero] = await Promise.all([
      this.chrome.requireHeroById(a.heroId),
      this.chrome.requireHeroById(b.heroId),
    ]);
    const match = this.deps.matches.start({
      copyId: copy.id,
      definition: this.deps.definition,
      timeStart,
      league: playerFrom(leagueHero, KIND_LEAGUE, a, this.deps.definition),
      cohort: playerFrom(cohortHero, KIND_COHORT, b, this.deps.definition),
    });
    this.deps.queue.noteMatchStarted();
    this.deps.delay.schedule({
      token: endToken(copy.id),
      dueAt: new Date(match.timeFinish * 1000),
      run: () => this.requestFinish(copy.id),
    });
    const waiting = {
      status: 100,
      title: this.deps.definition.title,
      start_time: String(timeStart),
      end_time: String(timeStart),
    };
    for (const player of match.players.values()) {
      this.deps.outbox.enqueue(player.accountId, { "arena|bg_waiting": waiting });
      this.deps.outbox.enqueue(player.accountId, { "arena|bg_waiting": { status: 100, start: 1 } });
      this.deps.wake.wake(player.accountId);
    }
    await this.chrome.pushEnter(leagueBefore.areaId, leagueHero, KIND_LEAGUE, match);
    await this.chrome.pushEnter(cohortBefore.areaId, cohortHero, KIND_COHORT, match);
  }

  async attack(accountId: number, nick: string): Promise<Readonly<Record<string, unknown>>> {
    const attacker = await this.chrome.requireHeroByAccount(accountId);
    const match = this.deps.matches.byHeroId(attacker.id);
    if (
      !match ||
      attacker.instanceCopyId !== match.copyId ||
      attacker.areaId !== this.deps.definition.arenaAreaId
    ) {
      throw new ProtocolError(203, "Здесь нельзя атаковать!");
    }
    const needle = nick.trim().toLowerCase();
    if (!needle) throw new ProtocolError(203, "укажите ник");
    const defenderRow = [...match.players.values()].find(
      (player) => player.nick.toLowerCase() === needle,
    );
    if (!defenderRow || defenderRow.heroId === attacker.id) {
      throw new ProtocolError(203, "игрок не найден");
    }
    const defender = await this.chrome.requireHeroById(defenderRow.heroId);
    if (
      defender.instanceCopyId !== match.copyId ||
      defender.areaId !== this.deps.definition.arenaAreaId
    ) {
      throw new ProtocolError(203, "игрок в другой локации");
    }
    if (
      (await this.deps.combat.activeFightId(attacker.accountId)) !== null ||
      (await this.deps.combat.activeFightId(defender.accountId)) !== null
    ) {
      throw new ProtocolError(203, "уже в бою");
    }
    if (attacker.ghost || defender.ghost) throw new ProtocolError(203, "нельзя атаковать");
    const fightId = await this.deps.combat.nextFightId();
    const [challengerStart, acceptorStart] = await Promise.all([
      this.chrome.fighterInput(attacker),
      this.chrome.fighterInput(defender),
    ]);
    const started = await this.deps.combat.startPvp({
      fightId,
      arena: this.deps.definition.fightBg,
      areaId: attacker.areaId,
      challenger: challengerStart,
      acceptor: acceptorStart,
    });
    const overlay = {
      instanceId: String(match.copyId),
      flags: this.deps.definition.fightFlags,
    };
    this.deps.outbox.enqueue(defender.accountId, {
      "fight|conf": this.deps.fightWire.pvpConfiguration(
        { ...started, participantId: defender.id },
        overlay,
      ),
    });
    this.deps.wake.wake(defender.accountId);
    return {
      "common|action": { status: 100, action: "ATTACK" },
      "fight|conf": this.deps.fightWire.pvpConfiguration(
        { ...started, participantId: attacker.id },
        overlay,
      ),
      "user|unitframe": await this.deps.bootstrap.unitframe(accountId),
      state: await this.deps.bootstrap.state(accountId),
    };
  }

  async afterFightFinished(notice: FightFinishedNotice): Promise<void> {
    if (notice.purpose !== "pvp") return;
    const hero = await this.chrome.requireHeroByAccount(notice.accountId);
    const match = this.deps.matches.byHeroId(hero.id);
    if (!match || match.finished) return;
    if (notice.outcome !== "last-leave") {
      const winnerHeroId =
        notice.winnerTeam === 1 ? hero.id : [...match.players.keys()].find((id) => id !== hero.id);
      if (winnerHeroId === undefined) {
        throw new Error(`Battleground PvP ${notice.fightId} is missing a winner`);
      }
      this.deps.matches.noteKill(match.copyId, winnerHeroId);
      await this.chrome.pushMapAndStats(match);
      if (
        match.scoreLeague >= match.definition.maxScore ||
        match.scoreCohort >= match.definition.maxScore
      ) {
        await this.requestFinish(match.copyId);
      }
    }
    await this.scheduleFinishIfIdle(match.copyId);
  }

  async reconcileAccount(accountId: number): Promise<void> {
    const hero = await this.chrome.requireHeroByAccount(accountId);
    if (!isBattlegroundRoom(this.deps.definition, hero.areaId)) return;
    if (this.deps.matches.byHeroId(hero.id)) return;
    await this.chrome.kickHero(hero, this.deps.definition.returnAreaId, hero.instanceCopyId);
  }

  private requestFinish(copyId: number): Promise<void> {
    const match = this.deps.matches.byCopyId(copyId);
    if (!match || match.finished) return Promise.resolve();
    match.pendingFinish = true;
    return this.scheduleFinishIfIdle(copyId);
  }

  private async scheduleFinishIfIdle(copyId: number): Promise<void> {
    const match = this.deps.matches.byCopyId(copyId);
    if (!match || match.finished || !match.pendingFinish) return;
    for (const player of match.players.values()) {
      if ((await this.deps.combat.activeFightId(player.accountId)) !== null) return;
    }
    this.deps.delay.cancel(finishToken(copyId));
    this.deps.delay.schedule({
      token: finishToken(copyId),
      dueAt: new Date(this.deps.clock.now().getTime() + FINISH_AFTER_FIGHT_MS),
      run: () => this.finishMatch(copyId),
    });
  }

  private async finishMatch(copyId: number): Promise<void> {
    const live = this.deps.matches.byCopyId(copyId);
    if (!live || live.finished) return;
    this.deps.delay.cancel(endToken(copyId));
    this.deps.delay.cancel(finishToken(copyId));
    const match = this.deps.matches.finish(copyId, this.deps.clock.unixSeconds());
    await this.deps.history.record({
      copyId: match.copyId,
      bgId: String(match.definition.id),
      bgType: match.definition.type,
      instArtikulId: match.definition.instArtikulId,
      title: match.definition.title,
      timeStart: match.timeStart,
      timeFinish: match.timeFinish,
      levelMin: match.definition.levelMin,
      levelMax: match.definition.levelMax,
      maxScore: match.definition.maxScore,
      scoreLeague: match.scoreLeague,
      scoreCohort: match.scoreCohort,
      winnerKind: match.winnerKind,
      players: [...match.players.values()],
    });
    const scoreText = `[${match.scoreLeague} : ${match.scoreCohort}]`;
    const winText = match.winnerKind
      ? ` (победили ${match.winnerKind === KIND_LEAGUE ? "Лига" : "Когорта"})`
      : "";
    const chat = `Битва "${match.definition.title}" окончена со счетом ${scoreText}${winText}`;
    for (const player of match.players.values()) {
      const hero = await this.chrome.requireHeroById(player.heroId);
      await this.chrome.kickHero(hero, player.returnAreaId, match.copyId);
    }
    for (const player of match.players.values()) {
      this.deps.outbox.enqueue(player.accountId, {
        "arena|bg_finish": bgStatsPayload({ match, viewer: player, finished: true }),
      });
      this.deps.wake.wake(player.accountId);
      await this.deps.chat.deliverSystem(player.accountId, chat);
    }
    this.deps.matches.unbind(copyId);
    this.deps.queue.noteMatchEnded();
  }
}

function playerFrom(
  hero: { id: number; accountId: number; nick: string },
  kind: number,
  queued: QueueHero,
  definition: BattlegroundDefinition,
) {
  return {
    heroId: hero.id,
    accountId: hero.accountId,
    nick: hero.nick,
    level: queued.level,
    kind,
    returnAreaId: definition.returnAreaId,
    dmg: 0,
    exp: 0,
    honor: 0,
    honorBonus: 0,
    killCnt: 0,
    deathCnt: 0,
    fatalityCnt: 0,
    rank: "0",
  };
}

function endToken(copyId: number): string {
  return `bg-end:${copyId}`;
}

function finishToken(copyId: number): string {
  return `bg-finish:${copyId}`;
}
