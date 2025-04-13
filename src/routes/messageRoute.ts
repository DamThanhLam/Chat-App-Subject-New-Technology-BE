import { Router } from "express";
import { UserService } from "../services/UserService";
import { Request, Response } from "express";
import upload_file, { upload_file_message } from "../middelwares/upload_file"
import S3Service from "../aws_service/s3.service";
import MessageService from "../services/MessageService";

const router = Router();
const messageService = new MessageService();

router.get("/", async (req: Request & { auth?: any }, res: Response) => {
  try {
    const friendId = req.query.friendId as string
    const userId = req.auth?.sub;
    const exclusiveStartKey = req.query.exclusiveStartKey as string || ""
    if (!friendId) res.status(400).json({ error: "receiver Id must not be null" })
    const messages = await messageService.getByReceiverId(userId, friendId, exclusiveStartKey);

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/get-latest-message", async (req: Request & { auth?: any }, res: Response) => {
  try {
    const friendId = req.query.friendId as string
    const userId = req.auth?.sub;
    if (!friendId) {
      res.status(400).json({ error: "friend Id must not be null" })
      return
    }
    const message = await messageService.getLatestMessage(userId, friendId);

    res.json(message);
    return

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/files", upload_file_message.array("images"), async (req, res) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }


  try {
    // Giả sử bạn muốn upload từng file lên S3:
    const uploadedUrls = await Promise.all(files.map(async(file) => {
      return{url: await S3Service.post(file),filename:file.originalname}
    }));
    console.log(uploadedUrls)
    res.json({
      message: "Images uploaded successfully",
      images: uploadedUrls, // trả về danh sách URL
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as messageRoute };

