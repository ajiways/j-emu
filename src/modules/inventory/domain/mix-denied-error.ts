import { SET_MIX_ERROR } from "./gear-sets.ts";

export class MixDeniedError extends Error {
  constructor() {
    super(SET_MIX_ERROR);
    this.name = "MixDeniedError";
  }
}
