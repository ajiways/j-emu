import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { Listing } from "../modules/auction/domain/listing.ts";
import type { ListingAttachment } from "../modules/auction/domain/listing-attachment.ts";
import { LISTING_KIND_TENDER } from "../modules/auction/domain/listing-kind.ts";
import {
  LISTING_STATUS_EXPIRED,
  LISTING_STATUS_SOLD,
} from "../modules/auction/domain/listing-status.ts";
import { letterAttachmentFromListing } from "./auction-attachment-map.ts";

type MailPort = Pick<MailService, "deliverSystemInbox">;
type Heroes = Pick<CharacterService, "getById">;

export async function deliverAuctionMail(
  mail: MailPort,
  heroes: Heroes,
  command: Readonly<{
    toHeroId: number;
    fromHeroId: number | null;
    fromNick: string;
    subject: string;
    text: string;
    moneyComeMinor: number;
    listing: Listing;
    withItem: boolean;
    item?: ListingAttachment;
  }>,
): Promise<void> {
  if (command.fromHeroId !== null) {
    const from = await heroes.getById(command.fromHeroId);
    if (!from) throw new Error(`Hero ${command.fromHeroId} is missing for auction mail`);
  }
  await mail.deliverSystemInbox({
    toHeroId: command.toHeroId,
    fromNick: command.fromNick,
    fromHeroId: command.fromHeroId,
    subject: command.subject,
    text: command.text,
    flags: 0,
    moneyComeMinor: command.moneyComeMinor,
    attachments: command.withItem
      ? [letterAttachmentFromListing(command.item ?? command.listing.attachment)]
      : [],
  });
}

export async function expireListing(
  listing: Listing,
  mail: MailPort,
  heroes: Heroes,
  save: (row: Listing) => Promise<void>,
): Promise<void> {
  if (listing.status !== "open") return;
  if (listing.kind === LISTING_KIND_TENDER) {
    await save({ ...listing, status: LISTING_STATUS_EXPIRED });
    if (listing.buyoutMinor > 0) {
      await deliverAuctionMail(mail, heroes, {
        toHeroId: listing.ownerHeroId,
        fromHeroId: null,
        fromNick: "Аукцион",
        subject: "Аукцион: возврат",
        text: `Заказ «${listing.title}» истёк. Золото возвращено на почту.`,
        moneyComeMinor: listing.buyoutMinor,
        listing,
        withItem: false,
      });
    }
    return;
  }
  if (listing.bidderHeroId) {
    const seller = await heroes.getById(listing.ownerHeroId);
    if (!seller) throw new Error(`Hero ${listing.ownerHeroId} is missing for auction expiry`);
    const bidder = await heroes.getById(listing.bidderHeroId);
    if (!bidder) throw new Error(`Hero ${listing.bidderHeroId} is missing for auction expiry`);
    await save({ ...listing, status: LISTING_STATUS_SOLD });
    await deliverAuctionMail(mail, heroes, {
      toHeroId: listing.bidderHeroId,
      fromHeroId: listing.ownerHeroId,
      fromNick: seller.nick,
      subject: "Аукцион: покупка",
      text: `Вы выиграли лот «${listing.title}», ${listing.amount} шт. Товар доставлен вам на почту.`,
      moneyComeMinor: 0,
      listing,
      withItem: true,
    });
    if (listing.currentBidMinor > 0) {
      await deliverAuctionMail(mail, heroes, {
        toHeroId: listing.ownerHeroId,
        fromHeroId: listing.bidderHeroId,
        fromNick: bidder.nick,
        subject: "Аукцион: продажа",
        text: `Лот «${listing.title}» продан по ставке. Деньги доставлены вам на почту.`,
        moneyComeMinor: listing.currentBidMinor,
        listing,
        withItem: false,
      });
    }
    return;
  }
  await save({ ...listing, status: LISTING_STATUS_EXPIRED });
  await deliverAuctionMail(mail, heroes, {
    toHeroId: listing.ownerHeroId,
    fromHeroId: null,
    fromNick: "Аукцион",
    subject: "Аукцион: возврат",
    text: `Лот «${listing.title}» истёк. Предметы вернутся на вашу почту.`,
    moneyComeMinor: 0,
    listing,
    withItem: true,
  });
}
