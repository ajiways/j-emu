import type { AreaLink } from "../../world/domain/area-link.ts";

type AreaConfHref =
  | Readonly<{
      object: "common";
      action: "action";
      form: Readonly<{ code: "COME_IN"; area_id: number }>;
    }>
  | Readonly<{ object: "npc"; action: "quests"; ref: number }>
  | Readonly<{
      object: "common";
      action: "action";
      form: Readonly<{ object_class: "AREA"; object_id: number; action_id: number }>;
    }>;

export type AreaConfItem = Readonly<{
  id: number;
  title: string;
  picture: string;
  description: string;
  href: AreaConfHref;
  direction: number;
  flags: number;
  confirm_question: "";
  to_id: string;
}>;

export function areaLinkToConfItem(link: AreaLink): AreaConfItem {
  const areaId = Number(link.toAreaId);
  if (!Number.isInteger(areaId) || areaId <= 0) {
    throw new Error(`Area link ${link.fromAreaId}:${link.itemId} to-area is not a numeric id`);
  }
  return {
    id: link.itemId,
    title: link.title,
    picture: link.picture,
    description: link.description,
    href: {
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: areaId },
    },
    direction: link.direction,
    flags: link.flags,
    confirm_question: "",
    to_id: link.toAreaId,
  };
}

export function npcConfItem(
  input: Readonly<{
    id: number;
    title: string;
    picture: string;
    description: string;
    npcId: number;
  }>,
): AreaConfItem {
  return {
    id: input.id,
    title: input.title,
    picture: input.picture,
    description: input.description,
    href: { object: "npc", action: "quests", ref: input.npcId },
    direction: 0,
    flags: 0,
    confirm_question: "",
    to_id: String(input.npcId),
  };
}

export function areaActionConfItem(
  input: Readonly<{
    id: number;
    title: string;
    picture: string;
    description: string;
    actionId: number;
  }>,
): AreaConfItem {
  return {
    id: input.id,
    title: input.title,
    picture: input.picture,
    description: input.description,
    href: {
      object: "common",
      action: "action",
      form: { object_class: "AREA", object_id: input.id, action_id: input.actionId },
    },
    direction: 0,
    flags: 0,
    confirm_question: "",
    to_id: "",
  };
}
