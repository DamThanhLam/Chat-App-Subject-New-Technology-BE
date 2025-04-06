import { Router } from 'express';
import multer from 'multer';
import { GroupChatService } from '../services/group-chat-service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Nhóm routes
router.post('/groups', GroupChatService.createGroup);
router.put('/groups/:groupId', GroupChatService.updateGroup);
router.get('/groups/:groupId', GroupChatService.getGroupInfo);

// Tin nhắn routes
router.post('/groups/:groupId/messages', upload.single('file'), GroupChatService.sendMessage);
router.get('/groups/:groupId/messages', GroupChatService.getMessages);

// Thành viên routes
router.post('/groups/:groupId/members', GroupChatService.addMemberToGroup);

export default router;