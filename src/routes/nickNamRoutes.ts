// src/routes/nicknameRoutes.ts
import { Router, Request, Response } from "express";
import * as nicknameService from "../services/NickNamService";

const router = Router();

// Endpoint để đổi tên ghi nhớ
router.post("/set", async (req: Request, res: Response) => {
  try {
    const { userId, targetUserId, nickname } = req.body;
    console.log("Received data:", req.body); // Debugging line

    if (!userId || !targetUserId || !nickname) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await nicknameService.setNickname(
      userId,
      targetUserId,
      nickname
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint để lấy tên ghi nhớ
router.get(
  "/get/:userId/:targetUserId",
  async (req: Request, res: Response) => {
    try {
      const { userId, targetUserId } = req.params;

      const result = await nicknameService.getNickname(userId, targetUserId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
