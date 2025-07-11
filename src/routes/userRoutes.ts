import { Router } from "express";
import { UserService } from "../services/UserService";
import { Request, Response } from "express";
import upload_file from "../middelwares/upload_file"
import S3Service from "../aws_service/s3.service";
import { getFriendList, getFriendListAccept, getPendingFriendRequests } from "../services/FriendService";
import multer from "multer";
interface AuthRequest extends Request {
  auth?: { sub?: string };
}
const router = Router();
const userService = new UserService();

router.put("/", async (req: Request & { auth?: any }, res: Response) => {
  const userId = req.auth?.sub;

  const data = req.body;

  try {
    const updatedUser = await userService.updateUserInfo(userId, data);

    console.log("Updated user before response:", updatedUser);

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    res.status(404).json({ error: error.message });
  }
});

router.get("/search", async (req, res) => {
  const { email } = req.query;
  console.log("Searching for email:", email);

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Invalid email query" });
  }

  try {
    // userRoutes.ts
    const emailNormalized = (email as string).toLowerCase();
    const users = await userService.findUsersByEmail(emailNormalized);

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }
    return res.status(200).json({ users });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
    return res.status(500).json({ message: errorMessage });
  }
});


router.get("/", async (req: Request & { auth?: any }, res: Response) => {
  try {
    const userId = req.auth?.sub;
    const user = await userService.getUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/friends/requests", async (req: AuthRequest, res) => {
  const userId = req.auth?.sub; // lấy userId từ token đã giải mã

  if (!userId) {
    return res.status(401).json({ message: "Invalid or missing token" });
  }

  try {
    const requests = await getPendingFriendRequests(userId);
    res.status(200).json({ requests }); // sửa chỗ này: trả về đúng key là `requests`
  } catch (error) {
    console.error("Error fetching friend requests:", error);
    res.status(500).json({ message: "Failed to get friend requests" });
  }
});


router.get("/friends", async (req: AuthRequest, res) => {
  const userId = req.auth?.sub;

  if (!userId) {
    return res.status(401).json({ message: "Invalid or missing token" });
  }

  try {
    const friends = await getFriendListAccept(userId);
    res.status(200).json({ friends });
  } catch (error) {
    console.error("Error fetching friends:", error);
    res.status(500).json({ message: "Failed to get friends" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    console.log(user)
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
/**
 * POST /api/user/:id/avatar
 * Upload avatar
 */
router.post("/avatar", (req, res, next) => {
  upload_file.single("image")(req, res, (err: any) => {
    if (err instanceof multer.MulterError || err instanceof Error) {
      return res.status(400).json( err.message);
    }
    next(); // không có lỗi → tiếp tục controller
  });
}, async (req: Request & { auth?: any }, res: Response) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const avatar = await S3Service.post(file);
    res.json({
      message: "Avatar updated successfully",
      avatar: avatar,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
export { router as userRoutes };
