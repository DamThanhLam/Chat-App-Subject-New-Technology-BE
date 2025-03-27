import { randomUUID } from "crypto";
import { User } from "../models/user";
import { hashPassword } from "../encryption/scrypto/scrypto";

const users = new Array();
export class UserRepository {
  createUser(user: User): User {
    user.id = randomUUID();
    users.push(user);
    return user;
  }
  getUsers(): Array<User> {
    return users;
  }

  getUserById(id: string): User | undefined {
    return users.find((user) => user.id === id);
  }

  addUserToGroup(userId: string, groupId: string): void {
    const user = this.getUserById(userId);
    if (user) {
      console.log(`User ${userId} added to group ${groupId}`);
    }
  }
}
