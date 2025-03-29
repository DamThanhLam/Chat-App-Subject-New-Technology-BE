import { Router } from 'express';
import multer from 'multer';
import { GroupChatController } from '../controllers/group-chat-controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Nhóm routes
router.post('/groups', GroupChatController.createGroup);
router.put('/groups/:groupId', GroupChatController.updateGroup);
router.get('/groups/:groupId', GroupChatController.getGroupInfo);

// Tin nhắn routes
router.post('/groups/:groupId/messages', upload.single('file'), GroupChatController.sendMessage);
router.get('/groups/:groupId/messages', GroupChatController.getMessages);

// Thành viên routes
router.post('/groups/:groupId/members', GroupChatController.addMemberToGroup);

export default router;