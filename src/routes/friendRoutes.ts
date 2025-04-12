import { Router, Request, Response } from "express";
import * as FriendService from "../services/FriendService";
import { authenticateJWT } from "../middelwares/authenticateJWT";
import { FriendStatus } from "../models/Friend";

const router = Router();

/**
 * GET /api/friends/get-friends/:userId
 * Trả về danh sách bạn bè của user
 */
router.get("/get-friends/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const friends = await FriendService.getFriendList(userId);

    return res.status(200).json({ friends });
  } catch (error) {
    console.error("Error getting friends:", error);
    return res.status(500).json({ message: "Failed to get friends" });
  }
});

/**
 * POST /api/friends/add
 * Tạo một lời mời kết bạn mới
 */
router.post("/add", async (req: Request, res: Response) => {
  const { senderId, receiverId, message } = req.body;

  if (!senderId || !receiverId) {
    return res.status(400).json({ message: "Missing senderId or receiverId" });
  }

  try {
    const friend = await FriendService.addFriend(senderId, receiverId, message);
    return res.status(201).json(friend);
  } catch (error) {
    console.error("Error creating friend:", error);
    return res.status(500).json({ message: "Failed to create friend" });
  }
});

router.get("/requests/:userId", authenticateJWT , async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const pendingRequests = await FriendService.getPendingFriendRequests(userId);
    return res.status(200).json({ requests: pendingRequests });
  } catch (error) {
    console.error("Error getting pending friend requests:", error);
    return res.status(500).json({ message: "Failed to get pending friend requests" });
  }
});

router.post("/accept/:userId", authenticateJWT, async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const updated = await FriendService.acceptFriendRequest(userId);
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return res.status(500).json({ message: "Failed to accept friend request" });
  }
});


export { router as friendRoutes };


