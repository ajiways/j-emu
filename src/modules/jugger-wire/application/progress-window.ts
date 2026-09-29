const PROGRESS_WINDOW_WIDTH = 380;
const HEADLINE_COLOR = "#ff0000";

export type WindowMacro = Readonly<{ key: string; token: string; macro: object }>;

export type ProgressWindowInput = Readonly<{
  headline: string;
  body: string;
  /** Icon before the headline (level windows); rank windows have none. */
  achievement: WindowMacro | null;
  greeting: WindowMacro;
  /** Icons of newly available items, rendered under the body. */
  artifacts: readonly WindowMacro[];
  /** Macros the body text already references by token. */
  bodyMacros: readonly WindowMacro[];
}>;

/** Live `common|window` for reaching a level (reg-6lvl dump); rank-ups reuse the same shape. */
export function progressWindow(input: ProgressWindowInput): Readonly<Record<string, unknown>> {
  if (!input.headline) throw new Error("Progress window headline is required");
  if (!input.body) throw new Error("Progress window body is required");
  const icons =
    input.achievement === null
      ? input.greeting.token
      : `${input.achievement.token} ${input.greeting.token}`;
  const lines = [
    icons,
    `<b><font color="${HEADLINE_COLOR}">${input.headline}</font></b><br>`,
    input.body,
  ];
  if (input.artifacts.length > 0) lines.push(input.artifacts.map((entry) => entry.token).join(" "));
  const macros = [
    ...(input.achievement === null ? [] : [input.achievement]),
    input.greeting,
    ...input.bodyMacros,
    ...input.artifacts,
  ];
  return {
    status: 100,
    title: "",
    image: "",
    width: PROGRESS_WINDOW_WIDTH,
    text: lines.join("\r\n"),
    macroses: Object.fromEntries(macros.map((entry) => [entry.key, entry.macro])),
    buttons: [{ caption: "Закрыть" }],
  };
}
