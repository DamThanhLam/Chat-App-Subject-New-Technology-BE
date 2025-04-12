import S3Service from "../aws_service/s3.service";
import { Message } from "../models/Message";
import { MessageRepository } from "../repository/MessageRepository";
const messageRepository = new MessageRepository();
import { Conversation } from "../models/Conversation";
import { getConversation } from "../repository/ConversationRepository";
export default class MessageService {
  async post(message: Message) {
    // Kiểm tra receiverId
    if (!message.receiverId) {
      throw new Error("Receiver ID must not be null.");
    }

    // Kiểm tra contentType
    switch (message.contentType) {
      case "text":
        if (
          typeof message.message !== "string" ||
          message.message.trim() === ""
        ) {
          throw new Error("Text message must be a non-empty string.");
        }
        break;

      case "emoji":
        if (
          typeof message.message !== "string" ||
          !/^[\u{1F600}-\u{1F64F}]+$/u.test(message.message)
        ) {
          throw new Error("Emoji message must be valid emoji string.");
        }
        break;

      case "file":
        const file = message.message;

        if (
          typeof file !== "object" ||
          !file.data ||
          !file.filename ||
          !file.mimetype ||
          typeof file.size !== "number"
        ) {
          throw new Error(
            "File message must contain data, filename, mimetype, and size."
          );
        }

        // Kiểm tra kiểu file hợp lệ
        const allowedMimeTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "video/mp4",
          "video/quicktime",
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new Error(
            "Unsupported file type. Only image/video files are allowed."
          );
        }

        // Kiểm tra dung lượng tối đa (ví dụ 10MB)
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) {
          throw new Error("File size exceeds the 20MB limit.");
        }
        break;

      default:
        throw new Error("Invalid content type.");
    }

    // Gán thời gian nếu chưa có
    if (!message.creatAt) {
      message.creatAt = new Date().toISOString();
    }

    if (!message.updateAt) {
      message.updateAt = message.creatAt;
    }
    if (message.contentType === "file") {
      const file: any = message.message;
      const urlFile = await S3Service.post({
        buffer: file.data,
        originalname: file.filename,
      });
      message.message = urlFile;
    }
    return messageRepository.post(message);
  }

  async searchMessages(
    userId: string,
    conversationId: string,
    keyword: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      if (!userId || !conversationId || !keyword) {
        throw new Error("Missing required fields");
      }

      // Lấy thông tin cuộc trò chuyện để kiểm tra quyền
      const conversation: Conversation | null = await getConversation(
        conversationId
      );
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Kiểm tra xem người dùng có trong cuộc trò chuyện không
      if (!conversation.participants.includes(userId)) {
        throw new Error("You are not a member of this conversation");
      }

      // Tìm kiếm tin nhắn với phân trang
      const result = await messageRepository.searchMessages(
        conversationId,
        keyword,
        page,
        limit
      );

      return {
        messages: result.items,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
      };
    } catch (error: any) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }
  }
}
