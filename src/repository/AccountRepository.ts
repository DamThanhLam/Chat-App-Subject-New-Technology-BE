import { randomUUID } from "crypto";
import Account from "../models/Account";
import { hashPassword, verifyPassword } from "../encryption/scrypto/scrypto";
import { log } from "console";

const accounts = new Array();
export class AccountRepository {
  async createAccount(account: Account) {
    const { derivedKey, salt } = await hashPassword(account.password);
    account.password = derivedKey;
    account.salt = salt;
    accounts.push(account);
  }
  async login(email: string, password: string): Promise<boolean> {
    console.log("accounts", accounts);

    const results = await Promise.all(
      accounts.map(async (item) => {
        return (
          item.email === email &&
          (await verifyPassword(password, {
            password: item.password,
            salt: item.salt,
          }))
        );
      })
    );

    return results.some((result) => result === true);
  }
}
