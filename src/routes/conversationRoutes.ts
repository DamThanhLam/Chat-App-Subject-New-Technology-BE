import { Router, Request, Response } from "express";
import * as conversationService from "../services/ConversationService";
import { authenticateJWT } from "../middelwares/authenticateJWT";

const router = Router();
router.get(
  "/:conversationId/approval-requests",
  authenticateJWT,
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const currentUserId = req.auth?.sub;
      const { conversationId } = req.params;

      if (!currentUserId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!conversationId) {
        return res
          .status(400)
          .json({ error: "conversationId must be provided" });
      }

      // Gọi service để lấy danh sách yêu cầu tham gia
      const requests = await conversationService.getApprovalRequests(
        conversationId,
        currentUserId
      );

      res.status(200).json({ requests });
    } catch (error: any) {
      console.error("Error fetching approval requests:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/create-group",
  authenticateJWT,
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const leaderId = req.auth?.sub;
      if (!leaderId) return res.status(401).json({ error: "Unauthorized" });

      const { participantIds, groupName } = req.body;

      if (!Array.isArray(participantIds)) {
        return res
          .status(400)
          .json({ error: "Danh sách thành viên phải là mảng" });
      }

      const result = await conversationService.createGroupConversation(
        leaderId,
        participantIds,
        groupName
      );

      return res.status(201).json(result);
    } catch (error: any) {
      console.error("Lỗi tạo nhóm:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/my-groups/:userId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "UserId là bắt buộc" });

      const groups = await conversationService.getConversationsOfUser(userId);
      return res.status(200).json(groups);
    } catch (error: any) {
      console.error("Lỗi khi lấy nhóm:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// Thêm thành viên vào nhóm chat
router.put(
  "/add-users/:conversationId",
  authenticateJWT,
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const currentUserId = req.auth?.sub;
      const { conversationId } = req.params;
      const { newUserIds } = req.body;

      if (!currentUserId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!conversationId) {
        return res
          .status(400)
          .json({ error: "conversationId must be provided" });
      }

      if (!newUserIds || !Array.isArray(newUserIds)) {
        return res
          .status(400)
          .json({ error: "newUserIds must be a non-empty array" });
      }

      const updatedConversation = await conversationService.addUsersToGroup(
        conversationId,
        currentUserId,
        newUserIds
      );

      res.json({
        message: "Thêm thành viên thành công",
        conversation: updatedConversation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// // Tìm các nhóm chung giữa hai người dùng
// router.get(
//   "/common-groups/:targetUserId",
//   async (req: Request & { auth?: any }, res: Response) => {
//     try {
//       const userId = req.auth?.sub; // Lấy userId từ auth
//       const { targetUserId } = req.params; // Lấy targetUserId từ params
//       const { page, limit } = req.query; // Lấy page, limit từ query parameter

//       if (!userId) {
//         return res
//           .status(401)
//           .json({ error: "Không được phép: Thiếu xác thực người dùng" });
//       }

//       if (!targetUserId) {
//         return res.status(400).json({ error: "Thiếu targetUserId" });
//       }

//       const pageNum = page ? parseInt(page as string, 10) : 1;
//       const limitNum = limit ? parseInt(limit as string, 10) : 10;

//       if (isNaN(pageNum) || pageNum < 1) {
//         return res.status(400).json({ error: "Trang phải là số dương" });
//       }

//       if (isNaN(limitNum) || limitNum < 1) {
//         return res.status(400).json({ error: "Giới hạn phải là số dương" });
//       }

//       const result = await conversationService.findCommonGroups(
//         userId,
//         targetUserId,
//         pageNum,
//         limitNum
//       );
//       res.json(result);
//     } catch (error: any) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// );
router.get(
  "/:conversationId",
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const currentUserId = req.auth?.sub; // Lấy currentUserId từ auth
      const { conversationId } = req.params; // Lấy conversationId từ params

      //       if (!currentUserId) {
      //         return res
      //           .status(401)
      //           .json({ error: "Không được phép: Thiếu xác thực người dùng" });
      //       }

      //       if (!conversationId) {
      //         return res.status(400).json({ error: "Thiếu conversationId" });
      //       }

      const conversation = await conversationService.getConversationById(
        conversationId,
        currentUserId
      );
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Rời khỏi nhóm chat
router.put(
  "/leave/:conversationId",
  authenticateJWT,
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const userId = req.auth?.sub;
      const { conversationId } = req.params;

      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!conversationId) {
        return res
          .status(400)
          .json({ error: "conversationId must be provided" });
      }

      await conversationService.leaveGroup(conversationId, userId);

      res.json({ message: "Rời nhóm thành công" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);
// Xóa nhóm chat (chỉ trưởng nhóm mới có quyền)
router.delete(
  "/delete/:conversationId",
  authenticateJWT,
  async (req: Request & { auth?: any }, res: Response) => {
    try {
      const currentUserId = req.auth?.sub;
      const { conversationId } = req.params;

      if (!currentUserId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing user authentication" });
      }

      if (!conversationId) {
        return res
          .status(400)
          .json({ error: "conversationId must be provided" });
      }

      await conversationService.deleteGroup(conversationId, currentUserId);

      res.json({ message: "Xóa nhóm thành công" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
