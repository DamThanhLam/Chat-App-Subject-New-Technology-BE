import { Router, Request, Response } from "express";
import * as nicknameService from "../services/NickNamService";

const router = Router();

// Endpoint để đổi tên ghi nhớ
router.post(
  "/set/:targetUserId",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const userId = req.auth?.sub;
      const { targetUserId } = req.params;
      const { nickname } = req.body;

      // Kiểm tra xem userId có tồn tại không (từ auth)
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      // Kiểm tra các trường bắt buộc
      if (!targetUserId || !nickname) {
        return res
          .status(400)
          .json({ error: "Missing required fields: targetUserId or nickname" });
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
  }
);

// Endpoint để lấy tên ghi nhớ
router.get(
  "/get/:targetUserId",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const userId = req.auth?.sub;
      const { targetUserId } = req.params;

      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!targetUserId) {
        return res.status(400).json({ error: "Missing targetUserId" });
      }

      const result = await nicknameService.getNickname(userId, targetUserId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
