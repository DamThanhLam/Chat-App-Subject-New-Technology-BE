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
}
