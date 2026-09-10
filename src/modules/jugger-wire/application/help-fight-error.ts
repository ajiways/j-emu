import { HuntJoinDenied } from "../../combat/domain/hunt-join-denied.ts";
import { ProtocolError } from "./protocol-error.ts";

function helpFightError(internal: string): ProtocolError {
  if (internal.includes("уже в бою")) {
    return new ProtocolError(203, "нельзя во время боя");
  }
  if (internal.includes("другой локации") || internal.includes("другой локац")) {
    return new ProtocolError(204, "Нельзя вмешаться в бой, находящийся в другой локации!");
  }
  if (internal.includes("не в бою") || internal.includes("не найден")) {
    if (internal.includes("игрок не в бою")) {
      return new ProtocolError(204, "Данный игрок сейчас не участвует в боях!");
    }
    return new ProtocolError(204, "Нельзя вмешаться в неактивный бой!");
  }
  return new ProtocolError(204, internal || "Нельзя вмешаться в бой!");
}

export function asHelpFightError(error: unknown): ProtocolError {
  if (error instanceof ProtocolError) return error;
  if (error instanceof HuntJoinDenied) return helpFightError(error.message);
  throw error;
}
