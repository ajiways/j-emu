import type { RandomSource } from "./random-source.ts";

const MACRO = /rand\[([^\]]*)\]/g;
const RANGE = /^(\d+)-(\d+)$/;

/**
 * Bot looks in the catalog carry `rand[...]` picks (`rand[1-10]` an integer, `rand[a#b,c#d]` one of
 * the listed parts); the client cannot read them, so each is settled once when the bot enters a fight.
 */
export function resolveBotBody(body: string, random: RandomSource): string {
  return body.replace(MACRO, (_match, options: string) => pick(options, random));
}

function pick(options: string, random: RandomSource): string {
  const range = RANGE.exec(options);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (min > max) throw new Error(`Bot body rand range ${options} is reversed`);
    return String(random.integer(min, max));
  }
  const parts = options.split(",");
  if (parts.some((part) => part === "")) throw new Error(`Bot body rand[${options}] is malformed`);
  const chosen = parts[random.integer(0, parts.length - 1)];
  if (chosen === undefined) throw new Error(`Bot body rand[${options}] picked nothing`);
  return chosen;
}
