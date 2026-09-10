import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import { PartyDeniedError } from "../modules/party/domain/party-denied-error.ts";
import { lotteryCapReached, lotteryRound } from "../modules/party/domain/party-lottery.ts";
import { normalizeNickList, parseGiveItems } from "../modules/party/domain/party-give-items.ts";
import { LOTTERY_CHAT_GAP_MS } from "../modules/party/domain/party-channel.ts";
import type { PartyBagService } from "../modules/party/application/party-bag-service.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import { emptyBagPayload } from "../modules/jugger-wire/application/party-bag-wire.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { PartyNotify } from "./party-notify.ts";

export type PartyBagOpsDeps = Readonly<{
  parties: PartyService;
  bags: PartyBagService;
  snapshot: PartySnapshot;
  notify: PartyNotify;
  characters: Pick<CharacterService, "getByAccountId">;
  inventory: InventoryService;
  userBag(accountId: number): Promise<object>;
  unitOfWork: UnitOfWork;
  clock: Clock;
  random: RandomSource;
  wait(ms: number): Promise<void>;
}>;

type Transfer = Readonly<{
  hero: Hero;
  artikulId: number;
  amount: number;
  skipTransferChat: boolean;
}>;

export class PartyBagOps {
  constructor(private readonly deps: PartyBagOpsDeps) {}

  userBag(accountId: number): Promise<object> {
    return this.deps.userBag(accountId);
  }

  async bagBlock(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const mem = await this.deps.parties.membership(hero.id);
    if (!mem) return emptyBagPayload();
    return this.deps.snapshot.bag(mem.party.id);
  }

  async give(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const lottery = Array.isArray(fields["nick"]);
    const outcome = await this.deps.unitOfWork.run(() => this.giveLocked(hero, fields, lottery));
    for (const transfer of outcome.transfers) {
      if (!transfer.skipTransferChat) {
        await this.deps.notify.chatGive(outcome.partyId, hero, transfer.hero, [
          { artikulId: transfer.artikulId, amount: transfer.amount },
        ]);
      }
      if (transfer.hero.id !== hero.id) {
        this.deps.notify.personal(transfer.hero.accountId, {
          "user|bag": await this.deps.userBag(transfer.hero.accountId),
        });
      }
    }
    await this.deps.notify.pushToParty(outcome.partyId, { "party|bag": outcome.bag });
    const blocks: Record<string, unknown> = {
      "party|give": { status: 100 },
      "party|bag": outcome.bag,
    };
    if (outcome.leaderReceived) {
      blocks["user|bag"] = await this.deps.userBag(accountId);
    }
    return { kind: "flat", blocks };
  }

  async drop(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const mem = await this.requireLeader(hero, "только лидер");
    const bag = await this.deps.unitOfWork.run(async () => {
      await this.dropLocked(mem.party.id, fields);
      return this.deps.snapshot.bag(mem.party.id);
    });
    await this.deps.notify.pushToParty(mem.party.id, { "party|bag": bag });
    return { kind: "flat", blocks: { "party|drop": { status: 100 }, "party|bag": bag } };
  }

  async dumpToLeader(partyId: number, leader: Hero): Promise<boolean> {
    return this.deps.unitOfWork.run(async () => {
      const rows = await this.deps.bags.dumpRows(partyId);
      if (rows.length < 1) return false;
      for (const row of rows) {
        const fits = await this.deps.inventory.canFitBag({
          characterId: leader.id,
          artifactId: row.artikulId,
          quantity: row.cnt,
        });
        if (!fits) throw new PartyDeniedError("У персонажа не хватит места в рюкзаке!");
      }
      const byArt = new Map<number, number>();
      for (const row of rows) {
        await this.deps.inventory.grantToBag({
          characterId: leader.id,
          artifactId: row.artikulId,
          quantity: row.cnt,
        });
        await this.deps.bags.dropQty(partyId, row.id, row.cnt);
        byArt.set(row.artikulId, (byArt.get(row.artikulId) ?? 0) + row.cnt);
      }
      const transferred = [...byArt.entries()].map(([artikulId, amount]) => ({
        artikulId,
        amount,
      }));
      await this.deps.notify.chatGive(partyId, leader, leader, transferred);
      return true;
    });
  }

  private async giveLocked(
    leader: Hero,
    fields: Readonly<Record<string, unknown>>,
    lottery: boolean,
  ): Promise<{
    partyId: number;
    bag: Readonly<Record<string, unknown>>;
    transfers: readonly Transfer[];
    leaderReceived: boolean;
  }> {
    const mem = await this.requireLeader(leader, "только лидер может раздавать");
    if (mem.party.distributeReadyAt > this.deps.clock.unixSeconds()) {
      throw new PartyDeniedError("подождите перед раздачей");
    }
    const want = parseGiveItems(fields["items"]);
    if (want.size < 1) throw new PartyDeniedError("предмет не найден");
    const nicks = normalizeNickList(fields["nick"]);
    if (nicks.length < 1) throw new PartyDeniedError("укажите получателя");
    const members = await this.deps.snapshot.memberHeroes(mem.party.id);
    const candidates = members.filter((row) =>
      nicks.some((nick) => nick.toLowerCase() === row.nick.toLowerCase()),
    );
    if (candidates.length < 1) throw new PartyDeniedError("игрок не в группе");
    const got = new Map<number, Map<number, { amount: number; skipTransferChat: boolean }>>();
    for (const [itemId, qty] of want) {
      for (let unit = 0; unit < qty; unit += 1) {
        const row = await this.deps.bags.requireItem(mem.party.id, itemId);
        const winner = lottery
          ? await this.lotteryWinner(mem.party.id, candidates, row.artikulId, leader.language)
          : await this.directWinner(candidates, row.artikulId);
        await this.deps.inventory.grantToBag({
          characterId: winner.hero.id,
          artifactId: row.artikulId,
          quantity: 1,
        });
        await this.deps.bags.takeOne(mem.party.id, itemId);
        const byArt = got.get(winner.hero.id) ?? new Map();
        const prev = byArt.get(row.artikulId) ?? { amount: 0, skipTransferChat: true };
        byArt.set(row.artikulId, {
          amount: prev.amount + 1,
          skipTransferChat:
            prev.amount === 0
              ? winner.skipTransferChat
              : prev.skipTransferChat && winner.skipTransferChat,
        });
        got.set(winner.hero.id, byArt);
      }
    }
    const byHero = new Map(members.map((row) => [row.id, row]));
    const transfers: Transfer[] = [];
    for (const [heroId, byArt] of got) {
      const member = byHero.get(heroId);
      if (!member) throw new Error(`Party give hero ${heroId} is missing`);
      for (const [artikulId, info] of byArt) {
        transfers.push({
          hero: member,
          artikulId,
          amount: info.amount,
          skipTransferChat: info.skipTransferChat,
        });
      }
    }
    return {
      partyId: mem.party.id,
      bag: await this.deps.snapshot.bag(mem.party.id),
      transfers,
      leaderReceived: got.has(leader.id),
    };
  }

  private async dropLocked(
    partyId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const want = parseGiveItems(fields["items"] ?? fields);
    if (want.size < 1 && fields["id"] != null) {
      const id = Number(fields["id"]);
      const qty = Math.max(1, Number(fields["cnt"] ?? fields["amount"] ?? 1));
      if (Number.isInteger(id) && id > 0) want.set(id, qty);
    }
    if (want.size < 1) throw new PartyDeniedError("предмет не найден");
    for (const [itemId, qty] of want) {
      await this.deps.bags.dropQty(partyId, itemId, qty);
    }
  }

  private async directWinner(
    candidates: readonly Hero[],
    artikulId: number,
  ): Promise<{ hero: Hero; skipTransferChat: boolean }> {
    const winner = candidates[0];
    if (!winner) throw new PartyDeniedError("игрок не в группе");
    const fits = await this.deps.inventory.canFitBag({
      characterId: winner.id,
      artifactId: artikulId,
      quantity: 1,
    });
    if (!fits) throw new PartyDeniedError("У персонажа не хватит места в рюкзаке!");
    return { hero: winner, skipTransferChat: false };
  }

  private async lotteryWinner(
    partyId: number,
    candidates: readonly Hero[],
    artikulId: number,
    lng: string,
  ): Promise<{ hero: Hero; skipTransferChat: boolean }> {
    const eligible: Hero[] = [];
    for (const candidate of candidates) {
      const fits = await this.deps.inventory.canFitBag({
        characterId: candidate.id,
        artifactId: artikulId,
        quantity: 1,
      });
      if (fits) eligible.push(candidate);
    }
    if (eligible.length < 1) {
      throw new PartyDeniedError("У персонажа не хватит места в рюкзаке!");
    }
    if (eligible.length === 1) {
      const only = eligible[0];
      if (!only) throw new PartyDeniedError("У персонажа не хватит места в рюкзаке!");
      return { hero: only, skipTransferChat: false };
    }
    let pool = eligible;
    let first = true;
    const pace = async () => {
      if (!first) await this.deps.wait(LOTTERY_CHAT_GAP_MS);
      first = false;
    };
    for (let round = 0; ; round += 1) {
      if (round > 0) {
        await pace();
        await this.deps.notify.chatLotteryTie(partyId, lng);
      }
      const result = lotteryRound(
        pool.map((hero) => hero.id),
        this.deps.random,
      );
      for (const roll of result.rolls) {
        await pace();
        const hero = pool.find((row) => row.id === roll.heroId);
        if (!hero) throw new Error(`Lottery roller ${roll.heroId} is missing`);
        await this.deps.notify.chatLotteryRoll(partyId, hero, roll.roll);
      }
      if (result.kind === "win") {
        const winner = pool.find((row) => row.id === result.winnerId);
        if (!winner) throw new Error(`Lottery winner ${result.winnerId} is missing`);
        await pace();
        await this.deps.notify.chatLotteryWin(partyId, winner, artikulId);
        return { hero: winner, skipTransferChat: true };
      }
      if (lotteryCapReached(round + 1)) {
        const fallback = pool.find((row) => row.id === result.tied[0]);
        if (!fallback) throw new Error("Lottery fallback winner is missing");
        await pace();
        await this.deps.notify.chatLotteryWin(partyId, fallback, artikulId);
        return { hero: fallback, skipTransferChat: true };
      }
      pool = result.tied.map((heroId) => {
        const hero = pool.find((row) => row.id === heroId);
        if (!hero) throw new Error(`Lottery tie hero ${heroId} is missing`);
        return hero;
      });
    }
  }

  private async requireLeader(hero: Hero, error: string) {
    const mem = await this.deps.parties.membership(hero.id);
    if (!mem || mem.party.leaderHeroId !== hero.id) {
      throw new PartyDeniedError(error);
    }
    return mem;
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
