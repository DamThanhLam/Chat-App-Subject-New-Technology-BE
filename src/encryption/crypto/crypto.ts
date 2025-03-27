import crypto from "crypto";
import fs from "fs";
import path from "path";

const privateKey = fs.readFileSync(
  path.join(__dirname, "../../../private.pem"),
  "utf8"
);

export function decryptedPassword(encryptedPassword: string): string {
  const decryptedPassword = crypto.privateDecrypt(
    // ✅ Dùng đúng hàm giải mã
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encryptedPassword, "base64") // 🔍 Đảm bảo đầu vào là Buffer
  );
  return decryptedPassword.toString("utf8");
}
