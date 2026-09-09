export class InvalidNoteMpError extends Error {
  constructor(mp: number, maxMp: number) {
    super(`MP ${mp} is outside [0, ${maxMp}]`);
    this.name = "InvalidNoteMpError";
  }
}
