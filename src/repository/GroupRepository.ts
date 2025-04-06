import { randomUUID } from "crypto";
import { Group } from "../models/Group";

const groups = new Array<Group>();

export class GroupRepository {
  createGroup(group: Group): Group {
    group.id = randomUUID();
    groups.push(group);
    return group;
  }

  getGroupById(id: string): Group | undefined {
    return groups.find((group) => group.id === id);
  }

  addInviteLinkToGroup(groupId: string, inviteLinkId: string): void {
    const group = this.getGroupById(groupId);
    if (group) {
      group.inviteLinks.push(inviteLinkId);
    }
  }

  addMemberToGroup(groupId: string, userId: string): void {
    const group = this.getGroupById(groupId);
    if (group && !group.members.includes(userId)) {
      group.members.push(userId);
    }
  }
}
