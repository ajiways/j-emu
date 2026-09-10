import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { SessionPresence } from "../modules/identity/ports/session-presence.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import { PartyDeniedError } from "../modules/party/domain/party-denied-error.ts";
import type { PartyJoinService } from "../modules/party/application/party-join-service.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import {
  emptyBagPayload,
  emptyMembersPayload,
} from "../modules/jugger-wire/application/party-wire.ts";
import type { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import { PartyJoinOps } from "./party-join-ops.ts";
import type { PartyNotify } from "./party-notify.ts";
import {
  partyCreateInput,
  partyFields,
  partySettingsPatch,
  requiredNick,
  searchPage,
} from "./party-form.ts";

export type PartyDeskDeps = Readonly<{
  parties: PartyService;
  join: PartyJoinService;
  snapshot: PartySnapshot;
  notify: PartyNotify;
  characters: Pick<CharacterService, "getByAccountId" | "getByNick" | "getById">;
  sessions: SessionPresence;
  bootstrap: BootstrapReadModel;
}>;

export class PartyDesk {
  private readonly joins: PartyJoinOps;

  constructor(private readonly deps: PartyDeskDeps) {
    this.joins = new PartyJoinOps(deps);
  }

  restore(heroId: number) {
    return this.deps.snapshot.restore(heroId);
  }

  async execute(
    key: string,
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const fields = partyFields(envelope);
    switch (key) {
      case "party|create":
        return this.create(accountId, fields);
      case "party|invite":
        return this.joins.invite(accountId, fields);
      case "party|confirm_invite":
        return this.joins.confirmInvite(accountId, fields);
      case "party|decline_invite":
        return this.joins.declineInvite(accountId, fields);
      case "party|kick":
        return this.kick(accountId, fields);
      case "party|leave":
        return this.leave(accountId);
      case "party|disband":
        return this.disband(accountId);
      case "party|change_leader":
        return this.changeLeader(accountId, fields);
      case "party|save_settings":
        return this.saveSettings(accountId, fields);
      case "party|search_list":
        return {
          kind: "nested",
          value: await this.deps.snapshot.searchList(fields, searchPage(fields)),
        };
      case "party|join":
        return this.joins.join(accountId, fields);
      case "party|confirm_join":
        return this.joins.confirmJoin(accountId, fields);
      case "party|decline_join":
        return this.joins.declineJoin(accountId, fields);
      case "party|members":
        return { kind: "nested", value: await this.membersBlock(accountId) };
      case "party|settings":
        return { kind: "nested", value: await this.settingsBlock(accountId) };
      case "party|bag":
        return { kind: "nested", value: emptyBagPayload() };
      default:
        throw new Error(`Party OA ${key} is not wired`);
    }
  }

  private async create(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const party = await this.deps.parties.create(hero.id, accountId, partyCreateInput(fields));
    const members = await this.deps.snapshot.members(party);
    const settings = this.deps.snapshot.settingsOrEmpty(party);
    await this.deps.notify.pushToParty(party.id, {
      "party|members": members,
      "party|settings": settings,
    });
    return {
      kind: "flat",
      blocks: {
        "party|create": { status: 100 },
        "party|members": members,
        "party|settings": settings,
        "party|bag": emptyBagPayload(),
        state: await this.deps.bootstrap.state(accountId),
      },
    };
  }

  private async kick(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const target = await this.memberByNick(hero.id, requiredNick(fields));
    const outcome = await this.deps.parties.kick(hero.id, target.id);
    await this.deps.notify.chatKick(outcome.party.id, target, hero);
    this.deps.notify.personalEmpty(
      target.accountId,
      await this.deps.bootstrap.state(target.accountId),
    );
    await this.deps.notify.pushToParty(outcome.party.id, {
      "party|members": await this.deps.snapshot.members(outcome.party),
      "party|settings": this.deps.snapshot.settingsOrEmpty(outcome.party),
    });
    return { kind: "flat", blocks: { "party|kick": { status: 100 } } };
  }

  private async leave(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const outcome = await this.deps.parties.leave(hero.id);
    if (outcome.kind === "disbanded") return this.afterDisband(hero, outcome, "party|leave");
    if (outcome.kind === "left") {
      this.deps.notify.personalEmpty(accountId, await this.deps.bootstrap.state(accountId));
      await this.deps.notify.pushToParty(outcome.party.id, {
        "party|members": await this.deps.snapshot.members(outcome.party),
        "party|settings": this.deps.snapshot.settingsOrEmpty(outcome.party),
      });
    }
    return {
      kind: "flat",
      blocks: {
        "party|leave": { status: 100 },
        "party|members": emptyMembersPayload(),
        state: await this.deps.bootstrap.state(accountId),
      },
    };
  }

  private async disband(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const outcome = await this.deps.parties.disband(hero.id);
    if (!outcome) return { kind: "flat", blocks: { "party|disband": { status: 100 } } };
    return this.afterDisband(hero, outcome, "party|disband");
  }

  private async changeLeader(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const target = await this.memberByNick(hero.id, requiredNick(fields));
    const party = await this.deps.parties.changeLeader(
      hero.id,
      hero.level,
      target.id,
      target.level,
    );
    await this.deps.notify.pushToParty(party.id, {
      "party|members": await this.deps.snapshot.members(party),
      "party|settings": this.deps.snapshot.settingsOrEmpty(party),
    });
    return { kind: "flat", blocks: { "party|change_leader": { status: 100 } } };
  }

  private async saveSettings(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const mem = await this.deps.parties.membership(hero.id);
    if (!mem) throw new PartyDeniedError("только лидер");
    const party = await this.deps.parties.saveSettings(
      hero.id,
      partySettingsPatch(fields, mem.party),
    );
    const settings = this.deps.snapshot.settingsOrEmpty(party);
    await this.deps.notify.pushToParty(party.id, { "party|settings": settings });
    if (party.lootRules !== mem.party.lootRules) {
      await this.deps.notify.chatRulesChange(party.id, party.lootRules, hero.language);
    }
    return {
      kind: "flat",
      blocks: { "party|save_settings": { status: 100 }, "party|settings": settings },
    };
  }

  private async afterDisband(
    hero: Hero,
    outcome: { partyId: number; members: readonly { accountId: number }[] },
    oaKey: string,
  ): Promise<OaEncodedResponse> {
    const accounts = outcome.members.map((row) => row.accountId);
    await this.deps.notify.chatDisband(outcome.partyId, hero, accounts);
    for (const accountId of accounts) {
      this.deps.notify.personal(accountId, {
        "party|members": emptyMembersPayload(),
        "party|bag": emptyBagPayload(),
        state: await this.deps.bootstrap.state(accountId),
      });
    }
    return {
      kind: "flat",
      blocks: {
        [oaKey]: { status: 100 },
        "party|members": emptyMembersPayload(),
        "party|bag": emptyBagPayload(),
        state: await this.deps.bootstrap.state(hero.accountId),
      },
    };
  }

  private async membersBlock(accountId: number) {
    const hero = await this.requireHero(accountId);
    const mem = await this.deps.parties.membership(hero.id);
    if (!mem) return emptyMembersPayload();
    return this.deps.snapshot.members(mem.party);
  }

  private async settingsBlock(accountId: number) {
    const hero = await this.requireHero(accountId);
    const mem = await this.deps.parties.membership(hero.id);
    return this.deps.snapshot.settingsOrEmpty(mem ? mem.party : null);
  }

  private async memberByNick(leaderHeroId: number, nick: string): Promise<Hero> {
    const mem = await this.deps.parties.membership(leaderHeroId);
    if (!mem) throw new PartyDeniedError("игрок не в группе");
    const heroes = await this.deps.snapshot.memberHeroes(mem.party.id);
    const target = heroes.find((row) => row.nick.toLowerCase() === nick.toLowerCase());
    if (!target) throw new PartyDeniedError("игрок не в группе");
    return target;
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
