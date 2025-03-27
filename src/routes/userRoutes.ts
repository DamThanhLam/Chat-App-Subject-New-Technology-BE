import { Router } from "express";
import { UserService } from "../services/UserService";

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

  

export default router;
