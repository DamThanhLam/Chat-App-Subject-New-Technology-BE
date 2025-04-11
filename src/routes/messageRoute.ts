import { Router } from "express";
import { UserService } from "../services/UserService";
import { Request, Response } from "express";
import upload_file from "../middelwares/upload_file"
import S3Service from "../aws_service/s3.service";
import MessageService from "../services/MessageService";

const router = Router();
const messageService = new MessageService();

router.get("/", async (req: Request & { auth?: any }, res: Response) => {
  try {
    const friendId = req.query.friendId as string
    const userId = req.auth?.sub;
    const exclusiveStartKey = req.query.exclusiveStartKey as string||""
    if(!friendId) res.status(400).json({error:"receiver Id must not be null"})
    const messages = await messageService.getByReceiverId(userId,friendId,exclusiveStartKey); 
    
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/get-latest-message", async (req: Request & { auth?: any }, res: Response) => {
    try {
      const friendId = req.query.friendId as string
      const userId = req.auth?.sub;
      if(!friendId){
        res.status(400).json({error:"friend Id must not be null"})
        return
      }
      const message = await messageService.getLatestMessage(userId,friendId); 
      
      res.json(message);
      return

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
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
  const avatar = await S3Service.post(file)

  try {
    // const updatedUser = await userService.updateUserInfo(id, { avatarUrl });
    res.json({
      message: "Avatar updated successfully",
      avatar:avatar,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
  
export { router as messageRoute };

