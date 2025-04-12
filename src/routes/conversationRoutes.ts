// src/routes/conversationRoutes.ts
import { Router, Request, Response } from "express";
import * as conversationService from "../services/ConversationService";

const router = Router();

// Tạo nhóm chat từ đoạn chat đôi
router.post(
  "/create-group",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const currentUserId = req.auth?.sub;
      const { friendUserId, additionalUserIds, groupName } = req.body;

      if (!currentUserId || !friendUserId) {
        return res.status(400).json({ error: "Missing required user IDs" });
      }

      const result = await conversationService.createGroupFromChat(
        currentUserId,
        friendUserId,
        additionalUserIds || [],
        groupName || "New Group"
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Thêm người dùng vào nhóm chat
router.post(
  "/add-users",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const currentUserId = req.auth?.sub;
      if (!currentUserId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }
      const { conversationId, newUserIds } = req.body;

      if (
        !conversationId ||
        !currentUserId ||
        !newUserIds ||
        !Array.isArray(newUserIds)
      ) {
        return res
          .status(400)
          .json({ error: "Missing or invalid required fields" });
      }

      const result = await conversationService.addUsersToGroup(
        conversationId,
        currentUserId,
        newUserIds
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/common-groups/:targetUserId",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const userId = req.auth?.sub; // Lấy userId từ auth
      const { targetUserId } = req.params; // Lấy targetUserId từ params
      const { page, limit } = req.query; // Lấy page, limit từ query parameter

      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!targetUserId) {
        return res.status(400).json({ error: "Missing targetUserId" });
      }

      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 10;

      if (isNaN(pageNum) || pageNum < 1) {
        return res
          .status(400)
          .json({ error: "Page must be a positive number" });
      }

      if (isNaN(limitNum) || limitNum < 1) {
        return res
          .status(400)
          .json({ error: "Limit must be a positive number" });
      }

      const result = await conversationService.findCommonGroups(
        userId,
        targetUserId,
        pageNum,
        limitNum
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
