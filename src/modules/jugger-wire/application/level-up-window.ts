const LEVEL_UP_WINDOW_WIDTH = 380;
const HEADLINE_COLOR = "#ff0000";

type WindowMacro = Readonly<{ key: string; token: string; macro: object }>;

export type LevelUpWindowInput = Readonly<{
  headline: string;
  body: string;
  achievement: WindowMacro;
  greeting: WindowMacro;
  artifacts: readonly WindowMacro[];
}>;

/** Live `common|window` for reaching a level (reg-6lvl dump: levels 2–6). */
export function levelUpWindow(input: LevelUpWindowInput): Readonly<Record<string, unknown>> {
  if (!input.headline) throw new Error("Level-up headline is required");
  if (!input.body) throw new Error("Level-up body is required");
  const macros = [input.achievement, input.greeting, ...input.artifacts];
  return {
    status: 100,
    title: "",
    image: "",
    width: LEVEL_UP_WINDOW_WIDTH,
    text: [
      `${input.achievement.token} ${input.greeting.token}`,
      `<b><font color="${HEADLINE_COLOR}">${input.headline}</font></b><br>`,
      input.body,
      input.artifacts.map((artifact) => artifact.token).join(" "),
    ].join("\r\n"),
    macroses: Object.fromEntries(macros.map((entry) => [entry.key, entry.macro])),
    buttons: [{ caption: "Закрыть" }],
  };
}
