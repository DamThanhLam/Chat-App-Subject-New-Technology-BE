import { randomUUID } from "crypto";
import { InviteLink } from "../models/InviteLink";

const inviteLinks = new Array<InviteLink>();

export class InviteLinkRepository {
  createInviteLink(inviteLink: InviteLink): InviteLink {
    inviteLink.id = randomUUID();
    inviteLinks.push(inviteLink);
    return inviteLink;
  }

  getInviteLinkByLink(link: string): InviteLink | undefined {
    return inviteLinks.find((l) => l.link === link);
  }
}
