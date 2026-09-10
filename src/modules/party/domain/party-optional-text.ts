/** Dump-optional PartyCreateParameters: omitted/empty → documented empty chrome. */
export function optionalPartyText(value: unknown, whenAbsent: string): string {
  if (value === undefined || value === null || value === "") return whenAbsent;
  return String(value);
}
