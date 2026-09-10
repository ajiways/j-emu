import { FLAG_JOIN_CONFIRM } from "../domain/party-flags.ts";
import { PartyDeniedError } from "../domain/party-denied-error.ts";
import type { PartyMemberRow, PartyRecord } from "../domain/party-record.ts";
import type { PartyCreateInput, PartyService } from "./party-service.ts";

export type InviteOutcome = Readonly<{
  party: PartyRecord;
  targetHeroId: number;
  targetAccountId: number;
}>;

export type ConfirmInviteOutcome = Readonly<{
  party: PartyRecord;
  members: readonly PartyMemberRow[];
}>;

export type DeclineInviteOutcome = Readonly<{
  leaderAccountId: number | null;
  partyId: number | null;
}>;

export type JoinOutcome =
  | Readonly<{ kind: "joined"; party: PartyRecord; members: readonly PartyMemberRow[] }>
  | Readonly<{
      kind: "pending";
      party: PartyRecord;
      leaderAccountId: number;
      applicantHeroId: number;
      applicantAccountId: number;
    }>;

export type ConfirmJoinOutcome = Readonly<{
  party: PartyRecord;
  members: readonly PartyMemberRow[];
  applicantHeroId: number;
  applicantAccountId: number;
}>;

export class PartyJoinService {
  constructor(private readonly parties: PartyService) {}

  invite(
    leaderHeroId: number,
    leaderAccountId: number,
    targetHeroId: number,
    targetAccountId: number,
    create: PartyCreateInput,
  ): Promise<InviteOutcome> {
    return this.parties.run(async () => {
      const mem = await this.parties.ensureParty(leaderHeroId, leaderAccountId, create);
      if (mem.party.leaderHeroId !== leaderHeroId) {
        throw new PartyDeniedError("только лидер может приглашать");
      }
      if (targetHeroId === leaderHeroId) throw new PartyDeniedError("нельзя пригласить себя");
      const party = await this.parties.lockRequired(mem.party.id);
      const members = await this.parties.listMembers(party.id);
      this.parties.requireCapacity(members.length);
      if (members.some((row) => row.heroId === targetHeroId)) {
        throw new PartyDeniedError("уже в группе");
      }
      if (await this.parties.membership(targetHeroId)) {
        throw new PartyDeniedError("игрок уже в группе");
      }
      await this.parties.replaceInvite(party.id, targetHeroId, leaderHeroId);
      return { party, targetHeroId, targetAccountId };
    });
  }

  confirmInvite(heroId: number, accountId: number, partyId: number): Promise<ConfirmInviteOutcome> {
    return this.parties.run(async () => {
      if (await this.parties.membership(heroId)) {
        throw new PartyDeniedError("Вы уже находитесь в группе!");
      }
      const invite = await this.parties.findInvite(partyId, heroId);
      if (!invite) throw new PartyDeniedError("приглашение не найдено");
      const party = await this.parties.lockRequired(partyId);
      const members = await this.parties.listMembers(party.id);
      this.parties.requireCapacity(members.length);
      await this.parties.deleteInvite(partyId, heroId);
      await this.parties.addMember(partyId, heroId, accountId);
      return { party, members: await this.parties.listMembers(party.id) };
    });
  }

  async declineInvite(heroId: number, partyId: number): Promise<DeclineInviteOutcome> {
    if (!Number.isInteger(partyId) || partyId < 1) {
      return { leaderAccountId: null, partyId: null };
    }
    return this.parties.run(async () => {
      const invite = await this.parties.findInvite(partyId, heroId);
      if (!invite) return { leaderAccountId: null, partyId: null };
      await this.parties.deleteInvite(invite.partyId, heroId);
      const party = await this.parties.getParty(invite.partyId);
      if (!party) return { leaderAccountId: null, partyId: invite.partyId };
      const members = await this.parties.listMembers(party.id);
      const leader = members.find((row) => row.heroId === party.leaderHeroId);
      return {
        leaderAccountId: leader ? leader.accountId : null,
        partyId: party.id,
      };
    });
  }

  join(
    heroId: number,
    accountId: number,
    partyId: number,
    password: string,
    leaderAccountId: number,
  ): Promise<JoinOutcome> {
    return this.parties.run(async () => {
      if (await this.parties.membership(heroId)) {
        throw new PartyDeniedError("Вы уже находитесь в группе!");
      }
      const party = await this.parties.lockRequired(partyId);
      if (party.password && party.password !== password) {
        throw new PartyDeniedError("Неверный пароль группы!");
      }
      const members = await this.parties.listMembers(party.id);
      this.parties.requireCapacity(members.length);
      if ((party.flags & FLAG_JOIN_CONFIRM) !== 0) {
        await this.parties.replaceInvite(party.id, heroId, heroId);
        return {
          kind: "pending",
          party,
          leaderAccountId,
          applicantHeroId: heroId,
          applicantAccountId: accountId,
        };
      }
      await this.parties.addMember(party.id, heroId, accountId);
      return { kind: "joined", party, members: await this.parties.listMembers(party.id) };
    });
  }

  confirmJoin(
    leaderHeroId: number,
    applicantHeroId: number,
    applicantAccountId: number,
  ): Promise<ConfirmJoinOutcome> {
    return this.parties.run(async () => {
      const mem = await this.parties.membership(leaderHeroId);
      if (!mem || mem.party.leaderHeroId !== leaderHeroId) {
        throw new PartyDeniedError("только лидер");
      }
      const invite = await this.parties.findInvite(mem.party.id, applicantHeroId);
      if (!invite) throw new PartyDeniedError("заявка не найдена");
      if (await this.parties.membership(applicantHeroId)) {
        await this.parties.deleteInvite(mem.party.id, applicantHeroId);
        throw new PartyDeniedError("игрок уже в группе");
      }
      const party = await this.parties.lockRequired(mem.party.id);
      const members = await this.parties.listMembers(party.id);
      this.parties.requireCapacity(members.length);
      await this.parties.deleteInvite(party.id, applicantHeroId);
      await this.parties.addMember(party.id, applicantHeroId, applicantAccountId);
      return {
        party,
        members: await this.parties.listMembers(party.id),
        applicantHeroId,
        applicantAccountId,
      };
    });
  }

  declineJoin(leaderHeroId: number, partyId: number, applicantHeroId: number): Promise<void> {
    return this.parties.run(async () => {
      const mem = await this.parties.membership(leaderHeroId);
      if (!mem || mem.party.leaderHeroId !== leaderHeroId) {
        throw new PartyDeniedError("только лидер");
      }
      await this.parties.deleteInvite(partyId, applicantHeroId);
    });
  }
}
