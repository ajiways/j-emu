export type UserMagicBlock = Readonly<{
  status: 100;
  gloves: readonly [];
}>;

export function emptyUserMagic(): UserMagicBlock {
  return { status: 100, gloves: [] };
}
