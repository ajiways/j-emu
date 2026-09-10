import { chatCrc } from "./chat-crc.ts";

export type ChatMessageFields = Readonly<{
  type: string;
  msg: string;
  lng: string;
  ctime: number;
  from?: string;
  from_level?: number;
  recipient_list?: readonly string[];
  is_self?: boolean;
  macroses?: Readonly<Record<string, unknown>>;
}>;

export type ChatMessageBlock = Readonly<{
  status: 100;
  message: Readonly<Record<string, unknown>>;
}>;

export type ChatMessageDraft = Omit<ChatMessageFields, "ctime">;

export function buildChatMessage(fields: ChatMessageFields): ChatMessageBlock {
  if (!fields.type) throw new Error("Chat message type is required");
  if (!fields.lng) throw new Error("Chat message lng is required");
  if (!Number.isInteger(fields.ctime) || fields.ctime < 1) {
    throw new Error("Chat message ctime is invalid");
  }
  const message: Record<string, unknown> = {
    type: fields.type,
    msg: fields.msg,
    lng: fields.lng,
    ctime: fields.ctime,
    crc_key: chatCrc(fields.msg),
  };
  if (fields.from) message.from = fields.from;
  if (fields.from_level !== undefined) message.from_level = fields.from_level;
  if (fields.recipient_list && fields.recipient_list.length > 0) {
    message.recipient_list = fields.recipient_list;
  }
  if (fields.is_self !== undefined) message.is_self = fields.is_self;
  if (fields.macroses && Object.keys(fields.macroses).length > 0) {
    message.macroses = fields.macroses;
  }
  return { status: 100, message };
}
