/** Hunt title from the old `resolveFightTitle` / live fight_info dump. */
export function huntFightTitle(heroNick: string, botNick: string): string {
  if (!heroNick) throw new Error("Hunt fight title requires the hero nick");
  if (!botNick) throw new Error("Hunt fight title requires the bot nick");
  return `Нападение ${heroNick} на ${botNick}`;
}
