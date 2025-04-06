import Account from "../models/Account";
import { AccountRepository } from "../repository/AccountRepository";
import { UserRepository } from "../repository/UserRepository";
import { User } from "../models/user";
import { GroupRepository } from "../repository/GroupRepository";
import { InviteLinkRepository } from "../repository/InviteLinkRepository";
import { randomUUID } from "node:crypto";
import { InviteLink } from "../models/InviteLink";

export class UserService {
  userRepository = new UserRepository();
  accountRepository = new AccountRepository();
<<<<<<< HEAD
  private groupRepository: GroupRepository;
  private inviteLinkRepository: InviteLinkRepository;

  constructor() {
    this.groupRepository = new GroupRepository();
    this.inviteLinkRepository = new InviteLinkRepository();
    this.userRepository = new UserRepository();
  }
  register(user: User, account: Account): User | null {
    if (this.checkBeforeRegister(user)) {
      this.accountRepository.createAccount(account);
      return this.userRepository.createUser(user);
=======

  async register(user: User, account: Account): Promise<User | null> {
    const canRegister = await this.checkBeforeRegister(user);
    if (canRegister) {
      await this.accountRepository.createAccount(account);
      return await this.userRepository.createUser(user);
>>>>>>> origin/endpoint/update-user-info
    }
    return null;
  }

  async login(email: string, password: string): Promise<boolean> {
    return await this.accountRepository.login(email, password);
  }

  async checkBeforeRegister(user: User): Promise<boolean> {
    const users = await this.userRepository.getUsers();

    const isDuplicate = users.some(
      (item) => item.email === user.email || item.phoneNumber === user.phoneNumber
    );

    return !isDuplicate;
  }

<<<<<<< HEAD
  createInviteLink(groupId: string, expiresInDays: number = 7): string {
    const group = this.groupRepository.getGroupById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const link = `invite_${randomUUID()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const inviteLink: InviteLink = {
      id: null,
      groupId,
      link,
      createdAt: new Date(),
      expiresAt,
    };

    const createdLink = this.inviteLinkRepository.createInviteLink(inviteLink);
    this.groupRepository.addInviteLinkToGroup(groupId, createdLink.id!);

    return link;
  }

  // Tham gia nhóm qua link
  joinGroupWithLink(link: string, userId: string): string {
    const inviteLink = this.inviteLinkRepository.getInviteLinkByLink(link);
    if (!inviteLink) {
      throw new Error("Invalid invite link");
    }

    // Kiểm tra link hết hạn
    const now = new Date();
    if (now > inviteLink.expiresAt) {
      throw new Error("Invite link has expired");
    }

    const group = this.groupRepository.getGroupById(inviteLink.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const user = this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Thêm user vào nhóm
    this.groupRepository.addMemberToGroup(inviteLink.groupId, userId);
    this.userRepository.addUserToGroup(userId, inviteLink.groupId);

    return `User ${userId} joined group ${inviteLink.groupId} successfully`;
=======
  async updateUserInfo(id: string, data: Partial<User>): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    const updatedUser = await this.userRepository.updateUser(id, data);
    if (!updatedUser) {
      throw new Error("Failed to update user");
    }
    return updatedUser;
>>>>>>> origin/endpoint/update-user-info
  }
}
