import type { Hero } from "../../character/domain/hero.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";

export type WelcomeMessageBlock = Readonly<{
  status: 100;
  message: Readonly<{
    type: "system";
    msg: string;
    lng: string;
    ctime: number;
    filters: Readonly<{ from_level: 1; to_level: 0 }>;
  }>;
}>;

export function buildWelcomeMessage(
  hero: Hero,
  template: string,
  clock: Clock,
): WelcomeMessageBlock {
  if (!template.includes("{nick}")) throw new Error("Welcome template must contain {nick}");
  return {
    status: 100,
    message: {
      type: "system",
      msg: template.split("{nick}").join(hero.nick),
      lng: hero.language,
      ctime: clock.unixSeconds(),
      filters: { from_level: 1, to_level: 0 },
    },
  };
}
