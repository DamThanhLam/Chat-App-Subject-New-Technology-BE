import { Router } from "express";
import { UserService } from "../services/UserService";
import { Request, Response } from "express";
import upload_file from "../middelwares/upload_file";
import S3Service from "../aws_service/s3.service";
import MessageService from "../services/MessageService";

const router = Router();
const messageService = new MessageService();

router.get("/", async (req: Request & { auth?: any }, res: Response) => {
  try {
    const friendId = req.query.friendId as string;
    const userId = req.auth?.sub;
    const exclusiveStartKey = (req.query.exclusiveStartKey as string) || "";
    if (!friendId)
      res.status(400).json({ error: "receiver Id must not be null" });
    const messages = await messageService.getByReceiverId(
      userId,
      friendId,
      exclusiveStartKey
    );

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.get(
  "/get-latest-message",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const friendId = req.query.friendId as string;
      const userId = req.auth?.sub;
      if (!friendId) {
        res.status(400).json({ error: "friend Id must not be null" });
        return;
      }
      const message = await messageService.getLatestMessage(userId, friendId);

      res.json(message);
      return;
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
/**
 * POST /api/user/:id/avatar
 * Upload avatar
 */
router.post("/avatar", upload_file.single("image"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Ví dụ tạo URL giả định từ server local
  const avatar = await S3Service.post(file);

  try {
    // const updatedUser = await userService.updateUserInfo(id, { avatarUrl });
    res.json({
      message: "Avatar updated successfully",
      avatar: avatar,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
        return res.status(400).json({
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

export { router as messageRoute };
