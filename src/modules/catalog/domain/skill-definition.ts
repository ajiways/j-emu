export class SkillDefinition {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly group: string,
    readonly order: string,
    readonly weight: string,
    readonly image: string,
    readonly valueKind: "number" | "string",
  ) {
    if (!id) throw new Error("Skill id is required");
    if (!title) throw new Error(`Skill ${id} title is required`);
    if (!group || !order || !weight) {
      throw new Error(`Skill ${id} group, order and weight are required`);
    }
  }
}
