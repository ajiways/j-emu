import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { SessionPresence } from "../modules/identity/ports/session-presence.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import { PartyDeniedError } from "../modules/party/domain/party-denied-error.ts";
import { partyBanKey } from "../modules/party/domain/party-ban-key.ts";
import type { PartyJoinService } from "../modules/party/application/party-join-service.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { PartyRecord } from "../modules/party/domain/party-record.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import { emptyBagPayload } from "../modules/jugger-wire/application/party-wire.ts";
import {
  inviteWindow,
  joinRequestWindow,
} from "../modules/jugger-wire/application/party-windows.ts";
import type { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import { buildUserMacro } from "../modules/jugger-wire/application/user-macro.ts";
import type { PartyNotify } from "./party-notify.ts";
import { optionalPartyId, partyCreateInput, requiredNick, requiredPartyId } from "./party-form.ts";

export type PartyJoinOpsDeps = Readonly<{
  parties: PartyService;
  join: PartyJoinService;
  snapshot: PartySnapshot;
  notify: PartyNotify;
  characters: Pick<CharacterService, "getByAccountId" | "getByNick" | "getById">;
  sessions: SessionPresence;
  bootstrap: BootstrapReadModel;
}>;

export class PartyJoinOps {
  constructor(private readonly deps: PartyJoinOpsDeps) {}

  async invite(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const nick = requiredNick(fields);
    if (nick.toLowerCase() === hero.nick.toLowerCase()) {
      throw new PartyDeniedError("нельзя пригласить себя");
    }
    const target = await this.requireOnlineByNick(nick);
    const issued = await this.deps.join.invite(
      hero.id,
      accountId,
      target.id,
      target.accountId,
      partyCreateInput(fields),
    );
    const token = buildUserMacro({ nick: hero.nick, level: hero.level, kind: hero.kind });
    this.deps.notify.personal(target.accountId, {
      "common|window": inviteWindow(
        issued.party.id,
        token,
        partyBanKey(issued.party.id, target.id),
      ),
    });
    await this.deps.notify.chatInviteSent(hero, target);
    return { kind: "flat", blocks: { "party|invite": { status: 100 } } };
  }

  async confirmInvite(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const joined = await this.deps.join.confirmInvite(hero.id, accountId, requiredPartyId(fields));
    return this.afterJoin(accountId, hero, joined.party, "party|confirm_invite");
  }

  async declineInvite(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const declined = await this.deps.join.declineInvite(hero.id, optionalPartyId(fields));
    if (declined.leaderAccountId !== null) {
      await this.deps.notify.chatDecline(hero, declined.leaderAccountId);
    }
    return {
      kind: "flat",
      blocks: {
        "party|decline_invite": { status: 100 },
        state: await this.deps.bootstrap.state(accountId),
      },
    };
  }

  async join(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const partyId = requiredPartyId(fields);
    const locked = await this.deps.parties.getParty(partyId);
    if (!locked) throw new PartyDeniedError("группа не найдена");
    const leader = await this.deps.characters.getById(locked.leaderHeroId);
    if (!leader) throw new Error(`Party ${partyId} leader hero ${locked.leaderHeroId} is missing`);
    const password = fields["password"] === undefined ? "" : String(fields["password"]);
    const outcome = await this.deps.join.join(
      hero.id,
      accountId,
      partyId,
      password,
      leader.accountId,
    );
    if (outcome.kind === "pending") {
      const token = buildUserMacro({ nick: hero.nick, level: hero.level, kind: hero.kind });
      this.deps.notify.personal(leader.accountId, {
        "common|window": joinRequestWindow(
          partyId,
          hero.nick,
          token,
          partyBanKey(partyId, hero.id),
        ),
      });
      return {
        kind: "flat",
        blocks: {
          "party|join": {
            status: 100,
            pending: 1,
            message: "Заявка на вступление отправлена лидеру группы!",
          },
        },
      };
    }
    return this.afterJoin(accountId, hero, outcome.party, "party|join");
  }

  async confirmJoin(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const applicant = await this.requireOnlineByNick(requiredNick(fields));
    const outcome = await this.deps.join.confirmJoin(hero.id, applicant.id, applicant.accountId);
    const members = await this.deps.snapshot.members(outcome.party);
    const settings = this.deps.snapshot.settingsOrEmpty(outcome.party);
    const bag = emptyBagPayload();
    await this.deps.notify.pushToParty(outcome.party.id, {
      "party|members": members,
      "party|settings": settings,
      "party|bag": bag,
    });
    await this.deps.notify.chatJoin(outcome.party.id, applicant);
    this.deps.notify.personal(applicant.accountId, {
      "party|members": members,
      "party|settings": settings,
      "party|bag": bag,
      state: await this.deps.bootstrap.state(applicant.accountId),
    });
    return { kind: "flat", blocks: { "party|confirm_join": { status: 100 } } };
  }

  async declineJoin(
    accountId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const mem = await this.deps.parties.membership(hero.id);
    const partyId = optionalPartyId(fields);
    const applicant = await this.requireOnlineByNick(requiredNick(fields));
    const targetPartyId = partyId > 0 ? partyId : mem ? mem.party.id : 0;
    await this.deps.join.declineJoin(hero.id, targetPartyId, applicant.id);
    this.deps.notify.personal(applicant.accountId, {
      "party|decline_join": {
        status: 100,
        message: "Лидер отклонил заявку на вступление в группу.",
      },
    });
    return { kind: "flat", blocks: { "party|decline_join": { status: 100 } } };
  }

  async afterJoin(
    accountId: number,
    hero: Hero,
    party: PartyRecord,
    oaKey: string,
  ): Promise<OaEncodedResponse> {
    const members = await this.deps.snapshot.members(party);
    const settings = this.deps.snapshot.settingsOrEmpty(party);
    const bag = emptyBagPayload();
    await this.deps.notify.pushToParty(party.id, {
      "party|members": members,
      "party|settings": settings,
      "party|bag": bag,
    });
    await this.deps.notify.chatJoin(party.id, hero);
    return {
      kind: "flat",
      blocks: {
        [oaKey]: { status: 100 },
        "party|members": members,
        "party|settings": settings,
        "party|bag": bag,
        state: await this.deps.bootstrap.state(accountId),
      },
    };
  }

  private async requireOnlineByNick(nick: string): Promise<Hero> {
    const hero = await this.deps.characters.getByNick(nick);
    const online = new Set(await this.deps.sessions.listAccountIdsWithSession());
    if (!hero || !online.has(hero.accountId)) throw new PartyDeniedError("игрок не в сети");
    return hero;
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
