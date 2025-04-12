// src/routes/messageRoutes.ts
import { Router, Request, Response } from "express";
import MessageService from "../services/MessageService";

const router = Router();
const messageService = new MessageService();
// Endpoint để tìm kiếm tin nhắn
router.get(
  "/search/:conversationId",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const userId = req.auth?.sub; // Lấy userId từ auth
      const { conversationId } = req.params; // Lấy conversationId từ params
      const { keyword, page, limit } = req.query; // Lấy keyword, page, limit từ query parameter

      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!conversationId || !keyword) {
        return res
          .status(400)
          .json({
            error: "Missing required fields: conversationId or keyword",
          });
      }

      if (typeof keyword !== "string") {
        return res.status(400).json({ error: "Keyword must be a string" });
      }

      // Xử lý page và limit
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

      const result = await messageService.searchMessages(
        userId,
        conversationId,
        keyword,
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
