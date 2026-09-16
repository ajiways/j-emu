import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type { DeathDurabilityBreak } from "../modules/inventory/domain/apply-death-durability.ts";
import { ChatDeniedError } from "../modules/chat/domain/chat-denied-error.ts";
import { chatChannelType, isAreaScopedChat } from "../modules/chat/domain/chat-channels.ts";
import { buildArtifactMacro } from "../modules/chat/domain/artifact-macro.ts";
import { artifactSkillWireMap } from "../modules/jugger-wire/application/artifact-skill-wire.ts";
import {
  buildArtifactItemMacro,
  type ArtifactItemMacroToken,
} from "../modules/chat/domain/artifact-item-macro.ts";
import { deathDurabilityMessage } from "../modules/chat/domain/death-durability-message.ts";
import {
  buildChatMessage,
  type ChatMessageBlock,
  type ChatMessageDraft,
} from "../modules/chat/domain/chat-message.ts";
import { buildFightMacro, huntFightTitle } from "../modules/chat/domain/fight-macro.ts";
import { buildMoneyMacro } from "../modules/chat/domain/money-macro.ts";
import { smileCatalogFromChrome } from "../modules/chat/domain/expand-smiles.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { PresenceService } from "../modules/world/application/presence-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { partyChannel } from "../modules/party/domain/party-channel.ts";
import { expandPlayerChat } from "./chat-expand.ts";
import { chatLng, chatRecipients, chatText } from "./chat-form.ts";

export type ChatDeskDeps = Readonly<{
  characters: Pick<CharacterService, "getByAccountId" | "getByNick">;
  world: WorldService;
  catalog: Catalog;
  combat: CombatPort;
  presence: PresenceService;
  clock: Clock;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  party: Readonly<{
    membership(heroId: number): Promise<{ party: { id: number } } | null>;
    memberAccountIds(partyId: number): Promise<readonly number[]>;
  }>;
}>;

export type ChatAddResult = Readonly<{ echo: ChatMessageBlock }>;

export type HuntStartChatInput = Readonly<{
  accountId: number;
  fightId: string;
  areaId: string;
  heroNick: string;
  botNick: string;
}>;

export class ChatDesk {
  constructor(private readonly deps: ChatDeskDeps) {}

  async add(
    accountId: number,
    form: Readonly<Record<string, unknown>> | undefined,
  ): Promise<ChatAddResult> {
    const hero = await this.requireHero(accountId);
    const text = chatText(form);
    if (!text) throw new ChatDeniedError(203, "empty message");
    const type = chatChannelType(form?.type);
    const recipients = chatRecipients(form?.recipient_list);
    const lng = chatLng(form?.lng, hero.language);
    const area = await this.deps.world.area(hero.areaId);
    const chrome = await this.deps.catalog.chrome();
    const expanded = await expandPlayerChat({
      text,
      hero,
      areaId: area.id,
      areaTitle: area.title,
      activeFightId: await this.deps.combat.activeFightId(accountId),
      smiles: smileCatalogFromChrome(chrome.block("user|smiles")),
      findByNick: (nick) => this.deps.characters.getByNick(nick),
    });
    if ("missingTarget" in expanded) {
      const tip = `Персонаж «${expanded.missingTarget}» не найден!`;
      return { echo: this.message({ type: "system", msg: tip, lng }) };
    }
    const sender = expanded.omitFrom ? {} : { from: hero.nick };
    const macroses = expanded.macroses;
    if (type === "private") {
      if (recipients.length === 0) throw new ChatDeniedError(203, "no recipient");
      const targets: number[] = [];
      for (const nick of recipients) {
        const peer = await this.deps.characters.getByNick(nick);
        if (!peer) throw new ChatDeniedError(2, "Пользователь не найден!");
        if (peer.accountId !== accountId) targets.push(peer.accountId);
      }
      const echo = this.message({
        type: "private",
        msg: expanded.msg,
        lng,
        ...sender,
        from_level: hero.level,
        recipient_list: recipients,
        is_self: true,
        macroses,
      });
      const remote = this.message({
        type: "private",
        msg: expanded.msg,
        lng,
        ...sender,
        from_level: hero.level,
        recipient_list: recipients,
        macroses,
      });
      for (const target of targets) this.deliver(target, remote);
      return { echo };
    }
    const listed = recipients.length > 0 ? { recipient_list: recipients } : {};
    const echo = this.message({
      type,
      msg: expanded.msg,
      lng,
      ...sender,
      from_level: hero.level,
      ...listed,
      is_self: true,
      macroses,
    });
    if (isAreaScopedChat(type)) {
      const remote = this.message({
        type,
        msg: expanded.msg,
        lng,
        ...sender,
        from_level: hero.level,
        ...listed,
        macroses,
      });
      const roster = await this.deps.presence.listPopulation(hero.areaId, hero.instanceCopyId);
      for (const info of roster.population) {
        if (info.id === accountId) continue;
        this.deliver(info.id, remote);
      }
    } else if (type === "party") {
      const mem = await this.deps.party.membership(hero.id);
      if (mem) {
        const remote = this.message({
          type: "party",
          msg: expanded.msg,
          lng,
          ...sender,
          from_level: hero.level,
          ...listed,
          macroses,
        });
        const channel = partyChannel(mem.party.id);
        const others = (await this.deps.party.memberAccountIds(mem.party.id)).filter(
          (id) => id !== accountId,
        );
        for (const target of others) this.deliver(target, remote, channel);
      }
    }
    return { echo };
  }

  async deliverSystem(
    accountId: number,
    msg: string,
    macroses?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const hero = await this.requireHero(accountId);
    this.deliver(
      accountId,
      this.message({
        type: "system",
        msg,
        lng: hero.language,
        ...(macroses ? { macroses } : {}),
      }),
    );
  }

  async notifyHuntStarted(input: HuntStartChatInput): Promise<void> {
    const area = await this.deps.world.area(input.areaId);
    const fight = buildFightMacro({
      fightId: input.fightId,
      areaId: area.id,
      areaTitle: area.title,
      fightTitle: huntFightTitle(input.heroNick, input.botNick),
    });
    await this.deliverSystem(input.accountId, `Начался бой ${fight.token}.`, {
      [fight.key]: fight.macro,
    });
  }

  async notifyFightEnded(
    outcome: FightOutcomeSnapshot,
    lootByAccount: ReadonlyMap<number, FightLootBlock>,
    breaksByAccount: ReadonlyMap<number, readonly DeathDurabilityBreak[]>,
  ): Promise<void> {
    for (const human of outcome.humans) {
      await this.notifyDeathBreaks(human.accountId, breaksByAccount.get(human.accountId) ?? []);
    }
    if (outcome.mode !== "hunt") return;
    const lead = outcome.humans[0];
    if (!lead) throw new Error(`Hunt ${outcome.fightId} has no humans`);
    const hero = await this.requireHero(lead.accountId);
    const area = await this.deps.world.area(hero.areaId);
    const bot = await this.deps.catalog.bot(outcome.botId);
    if (!bot) throw new Error(`Bot catalog entry ${outcome.botId} is missing`);
    const fight = buildFightMacro({
      fightId: outcome.fightId,
      areaId: area.id,
      areaTitle: area.title,
      fightTitle: huntFightTitle(hero.nick, bot.title),
    });
    for (const human of outcome.humans) {
      await this.deliverSystem(human.accountId, `Окончен бой ${fight.token}.`, {
        [fight.key]: fight.macro,
      });
      const loot = lootByAccount.get(human.accountId);
      if (!loot) continue;
      await this.notifyLootItems(human.accountId, loot);
      await this.notifyLootMoney(human.accountId, loot);
    }
  }

  async notifyDeathBreaks(
    accountId: number,
    breaks: readonly DeathDurabilityBreak[],
  ): Promise<void> {
    if (breaks.length === 0) return;
    const tokens: ArtifactItemMacroToken[] = [];
    for (const row of breaks) {
      const definition = await this.deps.catalog.artifact(row.artifactId);
      if (!definition) {
        throw new Error(`Artifact catalog entry ${row.artifactId} is missing`);
      }
      tokens.push(
        buildArtifactItemMacro({
          itemId: row.itemId,
          artifactId: definition.id,
          title: definition.title,
          picture: definition.picture,
          typeId: definition.typeId,
          kindId: definition.kindId,
          flags: definition.flags,
          flagsExt: definition.extra.flagsExt,
          priceMinor: definition.priceMinor,
          levelMin: definition.levelMin,
          levelMax: definition.levelMax,
          durability: row.durability,
          durabilityMax: row.durabilityMax,
          slot: row.slot,
          slotMask: definition.slotMask,
          skills: definition.skills,
        }),
      );
    }
    const line = deathDurabilityMessage(tokens);
    await this.deliverSystem(accountId, line.msg, line.macroses);
  }

  private async notifyLootItems(accountId: number, loot: FightLootBlock): Promise<void> {
    if (Array.isArray(loot.loot)) return;
    for (const entry of Object.values(loot.loot)) {
      const token = await this.artifactMacro(entry.artikul_id);
      await this.deliverSystem(accountId, `Вами получено: ${token.token} ${entry.amount} шт.`, {
        [token.key]: token.macro,
      });
    }
  }

  private notifyLootMoney(accountId: number, loot: FightLootBlock): Promise<void> {
    const gold = Number(loot.money);
    if (!Number.isFinite(gold)) throw new Error("Fight loot money is invalid");
    if (gold <= 0) return Promise.resolve();
    const token = buildMoneyMacro(gold, "1");
    return this.deliverSystem(accountId, `Вы получили: ${token.token}. `, {
      [token.key]: token.macro,
    });
  }

  async artifactMacro(artikulId: number) {
    const definition = await this.deps.catalog.artifact(artikulId);
    if (!definition) {
      throw new Error(`Artifact catalog entry ${artikulId} is missing`);
    }
    const skillBlocks = await artifactSkillWireMap(definition.skills, this.deps.catalog);
    return buildArtifactMacro({
      id: definition.id,
      title: definition.title,
      picture: definition.picture,
      typeId: definition.typeId,
      kindId: definition.kindId,
      priceMinor: definition.priceMinor,
      levelMin: definition.levelMin,
      levelMax: definition.levelMax,
      durability: definition.durability,
      durabilityMax: definition.durabilityMax,
      flags: definition.flags,
      slotMask: definition.slotMask,
      trend: definition.extra.trend,
      skillBlocks,
    });
  }

  private message(fields: ChatMessageDraft): ChatMessageBlock {
    return buildChatMessage({ ...fields, ctime: this.deps.clock.unixSeconds() });
  }

  private deliver(accountId: number, block: ChatMessageBlock, channel?: string): void {
    this.deps.outbox.enqueue(accountId, { "chat|message": block }, channel);
    this.deps.wake.wake(accountId);
  }

  private async requireHero(accountId: number) {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
