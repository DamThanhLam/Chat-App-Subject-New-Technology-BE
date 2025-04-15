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
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Đã là bạn bè, không thể gửi lời mời kết bạn") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error creating friend:", err);
    return res.status(500).json({ message: "Failed to create friend" });
  }
});


router.get("/requests/:userId", authenticateJWT, async (req: Request, res: Response) => {
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

router.post("/accept/:friendRequestId", async (req: Request, res: Response) => {
  const { friendRequestId } = req.params;

  try {
    const updatedRequest = await FriendService.acceptFriendRequest(friendRequestId);
    return res.status(200).json(updatedRequest);
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return res.status(500).json({ message: "Failed to accept friend request" });
  }
});


router.delete("/cancel/:id", authenticateJWT, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await FriendService.cancelFriendRequest(id);
    return res.status(200).json({ message: "Friend request cancelled" });
  } catch (error) {
    console.error("Error cancelling friend request:", error);
    return res.status(500).json({ message: "Failed to cancel friend request" });
  }
});

router.delete("/cancel", authenticateJWT, async (req: Request, res: Response) => {
  const { senderId, receiverId } = req.query;

  if (!senderId || !receiverId) {
    return res.status(400).json({ message: "Missing senderId or receiverId" });
  }

  try {
    await FriendService.cancelFriendRequestListFriend(senderId as string, receiverId as string);
    return res.status(200).json({ message: "Friend request cancelled" });
  } catch (error) {
    console.error("Error cancelling friend request:", error);
    return res.status(500).json({ message: "Failed to cancel friend request" });
  }
});

// API endpoint để kiểm tra trạng thái lời mời kết bạn (pending)
router.get('/check-pending-request', async (req: Request, res: Response) => {
  const { senderId, receiverId } = req.query;

  if (!senderId || !receiverId) {
    return res.status(400).json({ message: "senderId và receiverId là bắt buộc." });
  }

  try {
    const isPending = await FriendService.checkPendingRequest(senderId as string, receiverId as string);
    return res.status(200).json({ isPending });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Đã xảy ra lỗi khi kiểm tra trạng thái lời mời." });
  }
});

router.get("/", async (req: Request & { auth?: any }, res: Response) => {
  const userId = req.auth?.sub;

  if (!userId) {
    return res.status(401).json({ message: "Invalid or missing token" });
  }

  try {
    const friends = await FriendService.getFriendListAccept(userId);
    res.status(200).json({ friends });
  } catch (error) {
    console.error("Error fetching friends:", error);
    res.status(500).json({ message: "Failed to get friends" });
  }
});

export { router as friendRoutes };


