import type { AreaLink } from "../../world/domain/area-link.ts";

export type AreaConfItem = Readonly<{
  id: number;
  title: string;
  picture: string;
  description: string;
  href: Readonly<{
    object: "common";
    action: "action";
    form: Readonly<{ code: "COME_IN"; area_id: number }>;
  }>;
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
