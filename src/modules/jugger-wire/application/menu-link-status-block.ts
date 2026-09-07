export type MenuLinkStatusBlock = Readonly<{
  status: 100;
  menu_links: Readonly<Record<string, string>>;
}>;

export function buildMenuLinkStatus(
  menuLinks: Readonly<Record<string, string>>,
): MenuLinkStatusBlock {
  if (!menuLinks || typeof menuLinks !== "object" || Array.isArray(menuLinks)) {
    throw new Error("Menu links must be an object");
  }
  return { status: 100, menu_links: menuLinks };
}
