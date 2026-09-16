import { describe, expect, it } from "vitest";
import { chatCrc } from "../../../src/modules/chat/domain/chat-crc.ts";
import {
  expandFightHashTags,
  expandFightKeywords,
} from "../../../src/modules/chat/domain/expand-fight-tags.ts";
import { expandEmoFlavor } from "../../../src/modules/chat/domain/expand-emo.ts";
import { EMO_TEMPLATES } from "../../../src/modules/chat/domain/emo-templates.ts";
import { expandSmileTags } from "../../../src/modules/chat/domain/expand-smiles.ts";
import { buildFightMacro, huntFightTitle } from "../../../src/modules/chat/domain/fight-macro.ts";
import { buildArtifactItemMacro } from "../../../src/modules/chat/domain/artifact-item-macro.ts";
import { deathDurabilityMessage } from "../../../src/modules/chat/domain/death-durability-message.ts";
import { buildMoneyMacro } from "../../../src/modules/chat/domain/money-macro.ts";
import { parseEmoCommand } from "../../../src/modules/chat/domain/parse-emo-command.ts";
import { isUnmergedEsrvFragment } from "../../../src/modules/jugger-wire/application/esrv-chat-only-fragment.ts";
import { buildUserMacro } from "../../../src/modules/jugger-wire/application/user-macro.ts";

describe("chat macros", () => {
  it("crc is 8 lowercase hex chars and stable", () => {
    expect(chatCrc("hello")).toMatch(/^[0-9a-f]{8}$/);
    expect(chatCrc("hello")).toBe(chatCrc("hello"));
    expect(chatCrc("hello")).not.toBe(chatCrc("Hello"));
  });

  it("replaces at most three smile tags, longest first", () => {
    const macroses: Record<string, unknown> = {};
    const msg = expandSmileTags(
      ":):D:):):D",
      [
        { tag: ":D", smile: "D.swf", expire_time: 0 },
        { tag: ":)", smile: "smile.swf", expire_time: 0 },
      ],
      macroses,
    );
    expect(msg).toMatch(/\[\[SMILE /);
    expect(Object.keys(macroses)).toHaveLength(2);
    expect((msg.match(/\[\[SMILE /g) ?? []).length).toBe(3);
  });

  it("expands (бой) only when the sender is in a fight", () => {
    const macroses: Record<string, unknown> = {};
    const context = {
      areaId: "503",
      areaTitle: "Радвей",
      activeFightId: "12",
      fightTitleFor: () => "бой12",
    };
    expect(
      expandFightKeywords("go (бой) now", { ...context, activeFightId: null }, macroses, new Map()),
    ).toBe("go (бой) now");
    const inFight = expandFightKeywords("go (бой) now", context, macroses, new Map());
    expect(inFight).toContain("[[FIGHT ");
    expect(expandFightHashTags("see #FIGHT[12]#", context, macroses, new Map())).toContain(
      "[[FIGHT ",
    );
  });

  it("builds hunt fight title and money macro without fallbacks", () => {
    expect(huntFightTitle("Ann", "Грызль")).toBe("Нападение Ann на Грызль");
    const fight = buildFightMacro({
      fightId: "12",
      areaId: "503",
      areaTitle: "Радвей",
      fightTitle: huntFightTitle("Ann", "Грызль"),
    });
    expect(fight.macro.area_id).toBe(503);
    expect(fight.macro.fight_title).toBe("Нападение Ann на Грызль");
    const money = buildMoneyMacro(0.2, "1");
    expect(money.macro.amount).toBe("0.2");
    expect(money.token).toMatch(/^\[\[MONEY /);
  });

  it("formats death durability ARTIFACT_ITEM chat after −1", () => {
    const token = buildArtifactItemMacro({
      itemId: 100_001,
      artifactId: 9095,
      title: "Перчатка",
      picture: "glove.png",
      typeId: "32",
      kindId: 0,
      flags: 0,
      flagsExt: 0,
      priceMinor: 0,
      levelMin: 1,
      levelMax: 1,
      durability: 2,
      durabilityMax: 3,
      slot: 32,
      slotMask: 32,
      skills: [],
    });
    expect(token.token).toMatch(/^\[\[ARTIFACT_ITEM /);
    expect(token.macro.macro_type).toBe("ARTIFACT_ITEM");
    expect(token.macro.id).toBe(100_001);
    expect(token.macro.artikul_id).toBe(9095);
    expect(token.macro.durability).toBe(2);
    const line = deathDurabilityMessage([token]);
    expect(line.msg).toBe(`Вещи потеряли прочность: ${token.token} (-1).`);
    expect(line.macroses[token.key]).toEqual(token.macro);
    const broken = buildArtifactItemMacro({
      itemId: 100_001,
      artifactId: 9095,
      title: "Перчатка",
      picture: "glove.png",
      typeId: "32",
      kindId: 0,
      flags: 0,
      flagsExt: 0,
      priceMinor: 0,
      levelMin: 1,
      levelMax: 1,
      durability: 0,
      durabilityMax: 3,
      slot: 0,
      slotMask: 32,
      skills: [],
    });
    expect(broken.macro.durability).toBe(0);
    expect(broken.macro.durability_max).toBe(3);
    expect(deathDurabilityMessage([broken]).msg).toContain("(-1)");
  });

  it("expands /emo with USER macros and reports a missing target", () => {
    const parsed = parseEmoCommand("/emo привет Bob");
    expect(parsed && "tpl" in parsed).toBe(true);
    const self = buildUserMacro({ nick: "Ann", level: 1, kind: 1 });
    if (!parsed || !("tpl" in parsed)) throw new Error("emo parse");
    expect(expandEmoFlavor(parsed, self, null)).toEqual({ missingTarget: "Bob" });
    const other = buildUserMacro({ nick: "Bob", level: 2, kind: 1 });
    const ok = expandEmoFlavor(parsed, self, other);
    if ("missingTarget" in ok) throw new Error("target should resolve");
    expect(ok.omitFrom).toBe(true);
    expect(ok.msg).toContain(self.token);
    expect(ok.msg).toContain(other.token);
    expect(EMO_TEMPLATES.бой?.all).toContain("{self}");
  });

  it("keeps lone chat|message and bag_diff fragments unmerged", () => {
    expect(isUnmergedEsrvFragment({ "chat|message": { status: 100 } })).toBe(true);
    expect(isUnmergedEsrvFragment({ "user|bag_diff": { status: 100 } })).toBe(true);
    expect(isUnmergedEsrvFragment({ "chat|message": { status: 100 }, state: {} })).toBe(false);
  });
});
