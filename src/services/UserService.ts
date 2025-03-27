import Account from "../models/Account";
import { AccountRepository } from "../repository/AccountRepository";
import { UserRepository } from "../repository/UserRepository";
import { User } from "../models/user";

export class UserService {
  userRepository = new UserRepository();
  accountRepository = new AccountRepository();

  async register(user: User, account: Account): Promise<User | null> {
    const canRegister = await this.checkBeforeRegister(user);
    if (canRegister) {
      await this.accountRepository.createAccount(account);
      return await this.userRepository.createUser(user);
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
  }
}
