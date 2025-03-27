import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import Account from "../../models/Account";

// Chuyển đổi scrypt sang dạng hàm async để dễ sử dụng
const scryptAsync = promisify(scrypt);

// 📌 Hàm mã hóa mật khẩu
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex"); // Tạo salt ngẫu nhiên
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  return { derivedKey, salt };
}

// 📌 Hàm xác thực mật khẩu
export async function verifyPassword(
  enteredPassword: string,
  { stored, salt }: any
) {
  // Tạo hash từ mật khẩu nhập vào để so sánh
  const derivedKey = (await scryptAsync(enteredPassword, salt, 64)) as Buffer;

  // So sánh kết quả
  return derivedKey.toString("hex") === stored;
}
