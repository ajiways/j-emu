import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { DISTRIBUTE_COOLDOWN_SEC, MAX_PARTY_MEMBERS } from "../domain/party-channel.ts";
import { PartyDeniedError } from "../domain/party-denied-error.ts";
import type { PartyMemberRow, PartyMembership, PartyRecord } from "../domain/party-record.ts";
import type { PartyMembershipQuery } from "../ports/party-membership-query.ts";
import type { PartyRepository } from "../ports/party-repository.ts";

export type PartyCreateInput = Readonly<{
  flags: number;
  isSearch: number;
  password: string;
  instanceArtikulId: string;
  botArtikulId: string;
  type: string;
}>;

export type PartySettingsPatch = Readonly<{
  lootRules?: string;
  noChat?: number;
  password?: string;
  isSearch?: number;
  instanceArtikulId?: string;
  botArtikulId?: string;
  type?: string;
  flags?: number;
}>;

export type DisbandOutcome = Readonly<{
  partyId: number;
  leaderHeroId: number;
  members: readonly PartyMemberRow[];
}>;

export type LeaveOutcome =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "disbanded" } & DisbandOutcome>
  | Readonly<{
      kind: "left";
      party: PartyRecord;
      leaver: PartyMemberRow;
      members: readonly PartyMemberRow[];
    }>;

export type KickOutcome = Readonly<{
  party: PartyRecord;
  kicked: PartyMemberRow;
  members: readonly PartyMemberRow[];
}>;

export class PartyService implements PartyMembershipQuery {
  constructor(
    private readonly parties: PartyRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  membership(heroId: number): Promise<PartyMembership | null> {
    return this.parties.membershipByHero(heroId);
  }

  async inParty(heroId: number): Promise<boolean> {
    return (await this.membership(heroId)) !== null;
  }

  listMembers(partyId: number): Promise<readonly PartyMemberRow[]> {
    return this.parties.listMembers(partyId);
  }

  async memberAccountIds(partyId: number): Promise<readonly number[]> {
    return (await this.parties.listMembers(partyId)).map((row) => row.accountId);
  }

  getParty(partyId: number): Promise<PartyRecord | null> {
    return this.parties.getParty(partyId);
  }

  listSearchable(): Promise<readonly PartyRecord[]> {
    return this.parties.listSearchable();
  }

  findInvite(partyId: number, targetHeroId: number) {
    return this.parties.findInvite(partyId, targetHeroId);
  }

  deleteInvite(partyId: number, targetHeroId: number) {
    return this.parties.deleteInvite(partyId, targetHeroId);
  }

  create(heroId: number, accountId: number, input: PartyCreateInput): Promise<PartyRecord> {
    requireWireIdentity(heroId, "hero id");
    requireWireIdentity(accountId, "account id");
    return this.unitOfWork.run(async () => {
      if (await this.parties.membershipByHero(heroId)) {
        throw new PartyDeniedError("Вы уже находитесь в группе!");
      }
      return this.insertPartyWithLeader(heroId, accountId, input);
    });
  }

  ensureParty(
    heroId: number,
    accountId: number,
    input: PartyCreateInput,
  ): Promise<PartyMembership> {
    return this.unitOfWork.run(async () => {
      const existing = await this.parties.membershipByHero(heroId);
      if (existing) return existing;
      const party = await this.insertPartyWithLeader(heroId, accountId, input);
      return {
        party,
        member: { partyId: party.id, heroId, accountId, joinedAt: this.clock.now() },
      };
    });
  }

  kick(leaderHeroId: number, targetHeroId: number): Promise<KickOutcome> {
    requireWireIdentity(leaderHeroId, "hero id");
    requireWireIdentity(targetHeroId, "hero id");
    return this.unitOfWork.run(async () => {
      const mem = await this.requireLeader(leaderHeroId, "только лидер может исключать");
      if (targetHeroId === leaderHeroId) throw new PartyDeniedError("нельзя исключить себя");
      const party = await this.lockRequired(mem.party.id);
      const members = await this.parties.listMembers(party.id);
      const kicked = members.find((row) => row.heroId === targetHeroId);
      if (!kicked) throw new PartyDeniedError("игрок не в группе");
      await this.parties.deleteMember(party.id, targetHeroId);
      await this.markDistribute(party);
      return { party, kicked, members: members.filter((row) => row.heroId !== targetHeroId) };
    });
  }

  leave(heroId: number): Promise<LeaveOutcome> {
    requireWireIdentity(heroId, "hero id");
    return this.unitOfWork.run(async () => {
      const mem = await this.parties.membershipByHero(heroId);
      if (!mem) return { kind: "idle" };
      if (mem.party.leaderHeroId === heroId) {
        return { kind: "disbanded", ...(await this.disbandLocked(heroId, mem.party.id)) };
      }
      const party = await this.lockRequired(mem.party.id);
      await this.parties.deleteMember(party.id, heroId);
      await this.markDistribute(party);
      return {
        kind: "left",
        party,
        leaver: mem.member,
        members: await this.parties.listMembers(party.id),
      };
    });
  }

  disband(leaderHeroId: number): Promise<DisbandOutcome | null> {
    requireWireIdentity(leaderHeroId, "hero id");
    return this.unitOfWork.run(async () => {
      const mem = await this.parties.membershipByHero(leaderHeroId);
      if (!mem) return null;
      if (mem.party.leaderHeroId !== leaderHeroId) {
        throw new PartyDeniedError("Не удалось расформировать группу!");
      }
      return this.disbandLocked(leaderHeroId, mem.party.id);
    });
  }

  changeLeader(
    leaderHeroId: number,
    leaderLevel: number,
    targetHeroId: number,
    targetLevel: number,
  ): Promise<PartyRecord> {
    requireWireIdentity(leaderHeroId, "hero id");
    requireWireIdentity(targetHeroId, "hero id");
    return this.unitOfWork.run(async () => {
      const mem = await this.requireLeader(leaderHeroId, "только лидер");
      if (targetHeroId === leaderHeroId) throw new PartyDeniedError("уже лидер");
      const party = await this.lockRequired(mem.party.id);
      const members = await this.parties.listMembers(party.id);
      if (!members.some((row) => row.heroId === targetHeroId)) {
        throw new PartyDeniedError("игрок не в группе");
      }
      if (targetLevel < leaderLevel) {
        throw new PartyDeniedError(
          "Нельзя передавать лидерство этому персонажу, он не подходит по уровню!",
        );
      }
      const next = { ...party, leaderHeroId: targetHeroId };
      await this.parties.saveParty(next);
      return next;
    });
  }

  tagInstanceArtikul(heroId: number, artikulId: string): Promise<void> {
    if (!artikulId) throw new Error("Party instance artikul is required");
    return this.unitOfWork.run(async () => {
      const mem = await this.parties.membershipByHero(heroId);
      if (!mem) throw new Error(`Hero ${heroId} has no party to tag`);
      const party = await this.lockRequired(mem.party.id);
      if (party.instanceArtikulId === artikulId) return;
      await this.parties.saveParty({ ...party, instanceArtikulId: artikulId });
    });
  }

  saveSettings(leaderHeroId: number, patch: PartySettingsPatch): Promise<PartyRecord> {
    requireWireIdentity(leaderHeroId, "hero id");
    return this.unitOfWork.run(async () => {
      const mem = await this.requireLeader(leaderHeroId, "только лидер");
      const party = await this.lockRequired(mem.party.id);
      const next = applySettingsPatch(party, patch);
      if (next.lootRules !== "1" && next.lootRules !== "2" && next.lootRules !== "3") {
        throw new PartyDeniedError("loot_rules invalid");
      }
      await this.parties.saveParty(next);
      return next;
    });
  }

  requireCapacity(memberCount: number): void {
    if (memberCount >= MAX_PARTY_MEMBERS) throw new PartyDeniedError("группа полна");
  }

  lockRequired(partyId: number): Promise<PartyRecord> {
    return this.parties.lockParty(partyId).then((party) => {
      if (!party) throw new PartyDeniedError("группа не найдена");
      return party;
    });
  }

  addMember(partyId: number, heroId: number, accountId: number): Promise<void> {
    return this.parties.insertMember({
      partyId,
      heroId,
      accountId,
      joinedAt: this.clock.now(),
    });
  }

  replaceInvite(partyId: number, targetHeroId: number, fromHeroId: number): Promise<void> {
    return this.parties.replaceInvite({
      partyId,
      targetHeroId,
      fromHeroId,
      createdAt: this.clock.now(),
    });
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.unitOfWork.run(work);
  }

  private async insertPartyWithLeader(
    heroId: number,
    accountId: number,
    input: PartyCreateInput,
  ): Promise<PartyRecord> {
    const party = await this.parties.insertParty({
      leaderHeroId: heroId,
      lootRules: "1",
      noChat: 0,
      flags: input.flags,
      isSearch: input.isSearch,
      password: input.password,
      instanceArtikulId: input.instanceArtikulId,
      botArtikulId: input.botArtikulId,
      type: input.type,
      distributeReadyAt: 0,
      createdAt: this.clock.now(),
    });
    await this.parties.insertMember({
      partyId: party.id,
      heroId,
      accountId,
      joinedAt: this.clock.now(),
    });
    return party;
  }

  private async requireLeader(heroId: number, message: string): Promise<PartyMembership> {
    const mem = await this.parties.membershipByHero(heroId);
    if (!mem || mem.party.leaderHeroId !== heroId) throw new PartyDeniedError(message);
    return mem;
  }

  private async disbandLocked(leaderHeroId: number, partyId: number): Promise<DisbandOutcome> {
    const party = await this.lockRequired(partyId);
    if (party.leaderHeroId !== leaderHeroId) {
      throw new PartyDeniedError("Не удалось расформировать группу!");
    }
    const members = await this.parties.listMembers(partyId);
    await this.parties.deleteInvites(partyId);
    await this.parties.deleteMembers(partyId);
    await this.parties.deleteParty(partyId);
    return { partyId, leaderHeroId, members };
  }

  private markDistribute(party: PartyRecord): Promise<void> {
    return this.parties.saveParty({
      ...party,
      distributeReadyAt: this.clock.unixSeconds() + DISTRIBUTE_COOLDOWN_SEC,
    });
  }
}

function applySettingsPatch(party: PartyRecord, patch: PartySettingsPatch): PartyRecord {
  return {
    ...party,
    lootRules: patch.lootRules !== undefined ? patch.lootRules : party.lootRules,
    noChat: patch.noChat !== undefined ? patch.noChat : party.noChat,
    password: patch.password !== undefined ? patch.password : party.password,
    isSearch: patch.isSearch !== undefined ? patch.isSearch : party.isSearch,
    instanceArtikulId:
      patch.instanceArtikulId !== undefined ? patch.instanceArtikulId : party.instanceArtikulId,
    botArtikulId: patch.botArtikulId !== undefined ? patch.botArtikulId : party.botArtikulId,
    type: patch.type !== undefined ? patch.type : party.type,
    flags: patch.flags !== undefined ? patch.flags : party.flags,
  };
}
