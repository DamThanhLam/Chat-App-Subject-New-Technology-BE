import express from "express";
import { UserService } from "../services/UserService";
import { GroupRepository } from "../repository/GroupRepository";
import { Group } from "../models/Group";

const router = express.Router();
const userService = new UserService();
const groupRepository = new GroupRepository();
router.post("/groups", (req, res) => {
  try {
    const { name } = req.body; // Lấy tên nhóm từ body
    if (!name) {
      throw new Error("Group name is required");
    }

    const group: Group = {
      id: null,
      name,
      members: [],
      inviteLinks: [],
    };

    const createdGroup = groupRepository.createGroup(group);
    res.status(201).json({ group: createdGroup });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
// Endpoint để tạo link mời
router.post("/groups/:groupId/create-link", (req, res) => {
  try {
    const { groupId } = req.params;
    const inviteLink = userService.createInviteLink(groupId);
    res
      .status(201)
      .json({ inviteLink: `http://localhost:3000/api/join/${inviteLink}` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint để tham gia nhóm qua link
router.post("/groups/join/:link", (req, res) => {
  try {
    const { link } = req.params;
    const { userId } = req.body; // Giả sử userId được gửi trong body
    const result = userService.joinGroupWithLink(link, userId);
    res.status(200).json({ message: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export { router as groupRoutes };
