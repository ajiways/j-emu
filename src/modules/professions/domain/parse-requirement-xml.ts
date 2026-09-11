export type RequirementXml = Readonly<{ type: string; id: number; value: number }>;

export function parseRequirementXml(xml: string): readonly RequirementXml[] {
  const out: RequirementXml[] = [];
  const re = /<requirement\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const attrs = match[1] ?? "";
    const type = /type="([^"]*)"/i.exec(attrs)?.[1] ?? "";
    const id = Number(/id="([^"]*)"/i.exec(attrs)?.[1] ?? 0) || 0;
    const value = Number(/value="([^"]*)"/i.exec(attrs)?.[1] ?? 0) || 0;
    out.push({ type, id, value });
  }
  return out;
}
