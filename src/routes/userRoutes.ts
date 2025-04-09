import { Router } from "express";
import { UserService } from "../services/UserService";

const router = Router();
const userService = new UserService();

router.post("/", async (req, res) => {
  try {
    const { user, account } = req.body;
    const newUser = await userService.register(user, account);

    if (!newUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    res.status(201).json({
      message: "User created successfully",
      user: newUser
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

router.delete("/:id", async (req, res) => {
  try {
    const success = await userService.deleteUser(req.params.id);
    if (success) {
      res.json({ message: "User deleted successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
  
export { router as userRoutes };

