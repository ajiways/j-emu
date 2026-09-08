export class InvalidNoteHpError extends Error {
  constructor(hp: number, maxHp: number) {
    super(`HP ${hp} is outside [0, ${maxHp}]`);
    this.name = "InvalidNoteHpError";
  }
}
