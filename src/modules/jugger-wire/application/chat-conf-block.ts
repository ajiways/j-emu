export type ChatConfPolicy = Readonly<{
  protocol: string;
  key: string;
  chat_server: string;
}>;

export type ChatConfBlock = Readonly<{
  status: 100;
  protocol: string;
  cid: string;
  key: string;
  chat_server: string;
}>;

export function buildChatConf(accountId: number, policy: ChatConfPolicy): ChatConfBlock {
  if (!Number.isInteger(accountId) || accountId < 1) {
    throw new Error("Chat conf account id must be a positive integer");
  }
  if (!policy.protocol) throw new Error("Chat protocol is required");
  if (!policy.key) throw new Error("Chat key is required");
  if (!policy.chat_server) throw new Error("Chat server URL is required");
  return {
    status: 100,
    protocol: policy.protocol,
    cid: String(accountId),
    key: policy.key,
    chat_server: policy.chat_server,
  };
}
