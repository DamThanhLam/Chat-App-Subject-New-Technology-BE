import { Router, Request, Response } from "express";
import { FriendService } from "../services/FriendService";

const router = Router();
const friendService = new FriendService();

router.post("/send-request", async (req: Request, res: Response) => {
  try {
    const { senderId, receiverId, message } = req.body;
    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await friendService.sendFriendRequest(senderId, receiverId, message);
    res.status(201).json({ message: "Friend request sent successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/list/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const friends = await friendService.getFriendRequests(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  

router.post("/accept/:id", async (req: Request, res: Response) => {
  try {
    await friendService.acceptFriendRequest(req.params.id);
    res.json({ message: "Friend request accepted" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/decline/:id", async (req: Request, res: Response) => {
  try {
    await friendService.declineFriendRequest(req.params.id);
    res.json({ message: "Friend request declined" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/cancel/:id", async (req: Request, res: Response) => {
  try {
    await friendService.cancelFriendRequest(req.params.id);
    res.json({ message: "Friend request cancelled" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/remove/:id", async (req: Request, res: Response) => {
  try {
    await friendService.deleteFriendRequest(req.params.id);
    res.json({ message: "Friend removed" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export { router as friendRoutes };
