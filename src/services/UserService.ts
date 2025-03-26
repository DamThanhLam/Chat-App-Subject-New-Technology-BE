import Account from "../models/Account";
import { AccountRepository } from "../repository/AccountRepository";
import { UserRepository } from "../repository/UserRepository";
import { User } from "../models/user";

export class UserService {
  userRepository = new UserRepository();
  accountRepository = new AccountRepository();
  register(user: User, account: Account): User | null {
    if (this.checkBeforeRegister(user)) {
      this.accountRepository.createAccount(account);
      return this.userRepository.createUser(user);
    }
    return null;
  }
  async login(email: string, password: string): Promise<boolean> {
    return await this.accountRepository.login(email, password);
  }
  checkBeforeRegister(user: User): boolean {
    const users = this.userRepository.getUsers();

    const isDuplicate = users.some(
      (item) =>
        item.email === user.email || item.phoneNumber === user.phoneNumber
    );

    return !isDuplicate;
  }
}
