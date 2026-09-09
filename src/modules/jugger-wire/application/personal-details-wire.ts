/**
 * Live `heroBuilder` always emits `use_fproxy: 1` on personal_details.
 * Without it CEF authenticates the fight on TCP :33120 and never POSTs
 * fproxy `auth`, so poll cannot deliver `oppnew` / `attacknow`.
 */
export function withHttpsFproxy(
  info: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return { ...info, use_fproxy: 1 };
}
