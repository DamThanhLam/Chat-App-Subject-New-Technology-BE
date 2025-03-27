import { Router } from "express";
import path from "path";
import { decryptedPassword } from "../encryption/crypto/crypto";
import Account from "../models/Account";
import { UserService } from "../services/UserService";
import { User } from "../models/user";
import { v4 as uuidv4 } from "uuid"; // Import UUID để tạo ID

const userService = new UserService();

const router = Router();

router.get("/register", async (req, res) => {
  res.sendFile(path.join(__dirname, "../views/auth/register.html"));
});

router.post("/register", async (req, res) => {
  const { username, email, phoneNumber, password } = req.body;

  if (!username || !email || !password || !phoneNumber) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const decryptedPass = decryptedPassword(password);
  console.log(decryptedPass);
    const user: User = {
    id: uuidv4(), 
    name: username,
    email,
    phoneNumber,
    status: "offline", 
    createdAt: new Date(),
    updatedAt: new Date(),
    urlAVT: "", 
  };
  const account: Account = { email, password: decryptedPass, salt: "" };

  const createdUser = await userService.register(user, account);

  if (createdUser) {
    return res
      .status(200)
      .send({ code: 200, message: "Registration successful" });
  }

  res
    .status(400)
    .send({ code: 400, message: "email or phone number have existed." });
});

export { router as registerRoutes };
