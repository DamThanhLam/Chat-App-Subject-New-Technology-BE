import { Router } from "express";
import { UserService } from "../services/UserService";

import upload_file from "../middelwares/upload_file"
import S3Service from "../aws_service/s3.service";

const router = Router();
const userService = new UserService();

router.put("/:id", async (req, res) => { 
  const id = req.params.id;
  const data = req.body;

  try {
    const updatedUser = await userService.updateUserInfo(id, data);  

    console.log("Updated user before response:", updatedUser); 

    res.json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    res.status(404).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id); 
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
/**
 * POST /api/user/:id/avatar
 * Upload avatar
 */
router.post("/:id/avatar", upload_file, async (req, res) => {
  const id = req.params.id;
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
  
export { router as userRoutes };

