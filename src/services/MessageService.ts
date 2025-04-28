import path from "path";
import fs from "fs";
import FileType from "file-type";
import S3Service from "../aws_service/s3.service";
import { FileMessage, Message } from "../models/Message";
import { MessageRepository } from "../repository/MessageRepository";
import { Conversation } from "../models/Conversation";
import { getConversation } from "../repository/ConversationRepository";

const messageRepository = new MessageRepository();
export default class MessageService {
  async post(message: Message) {
    if (message.messageType === "private") {
      if (!message.receiverId) {
        throw new Error("Receiver ID must not be null for private messages.");
      }
      message.conversationId = undefined;
    } else if (message.messageType === "group") {
      if (!message.conversationId) {
        throw new Error("Conversation ID must not be null for group messages.");
      }

      message.receiverId = undefined;
    } else {
      throw new Error("Invalid message type.");
    }
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
        // Regex này chỉ kiểm tra các emoji trong một số block Unicode cụ thể.
        // Có thể cần regex phức tạp hơn hoặc kiểm tra khác tùy thuộc vào định nghĩa "valid emoji" của bạn.
        if (
          typeof message.message !== "string" ||
          !message.message.split("").every((char) => /\p{Emoji}/u.test(char)) // Kiểm tra từng ký tự có phải là emoji không
        ) {
          // Fallback kiểm tra regex cũ nếu regex mới không hoạt động hoặc môi trường không hỗ trợ đầy đủ unicode property escapes
          if (
            typeof message.message !== "string" ||
            !/^[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+$/u.test(
              message.message
            ) // Regex phức tạp hơn cho nhiều loại emoji
          ) {
            throw new Error("Emoji message must be a valid emoji string.");
          }
        }
        break;

      case "file":
        // Đối với tin nhắn file, nội dung message nên là object FileMessage
        if (typeof message.message !== "object" || message.message === null) {
          throw new Error("File message content must be an object.");
        }
        const fileMessageContent = message.message as FileMessage;
        if (
          !fileMessageContent.data ||
          typeof fileMessageContent.data !== "string"
        ) {
          throw new Error(
            "File message object must contain a 'data' property (URL)."
          );
        }
        // Thêm các kiểm tra khác cho filename, size, type nếu cần thiết
        break;

    }

    // Gán thời gian nếu chưa có (hoặc luôn gán để đảm bảo server-side timestamp)
    // Backend Socket handler đã set thời gian, nhưng gán lại ở đây cũng không sao,
    // miễn là repository sử dụng giá trị này hoặc tự gán nếu chưa có.
    if (!message.createdAt) {
      message.createdAt = new Date().toISOString();
    }
    // Luôn cập nhật updatedAt
    message.updatedAt = new Date().toISOString();

    // Các thuộc tính khác cần đảm bảo tồn tại hoặc có giá trị mặc định
    if (!message.senderId || typeof message.senderId !== "string") {
      throw new Error("Sender ID is required and must be a string.");
    }
    // Status nên được set từ Socket handler (sended/received), nhưng có thể gán mặc định ở đây
    if (!message.status) {
      message.status = "sended"; // Mặc định là 'sended' khi tạo mới
    }
    // readed nên là mảng rỗng mặc định
    if (!message.readed) {
      message.readed = [];
    }

    // Lưu tin nhắn vào repository
    return messageRepository.post(message);
  }

  async getByReceiverId(
    userId: string,
    friendId: string,
    exclusiveStartKey: string
  ): Promise<Message[] | null> {
    return await messageRepository.getMessagesByFriendId(
      userId,
      friendId,
      exclusiveStartKey
    );
  }
  async getLatestMessage(
    userId: string,
    friendId: string
  ): Promise<Message | null> {
    return await messageRepository.getLatestMessage(userId, friendId);
  }
  async getById(messageId: string): Promise<Message | null> {
    return await messageRepository.getById(messageId);
  }
  async update(message: Message) {
    await messageRepository.update(message);
  }

  async markSingleChatAsDeleted(currentUserId: string, friendId: string) {
    try {
      if (!currentUserId || typeof currentUserId !== "string") {
        throw new Error("currentUserId không hợp lệ");
      }

      if (!friendId || typeof friendId !== "string") {
        throw new Error("friendId không hợp lệ");
      }

      await messageRepository.markMessagesAsDeleted(currentUserId, friendId);
    } catch (error: any) {
      throw new Error(
        `Không thể đánh dấu xóa lịch sử trò chuyện: ${error.message}`
      );
    }
  }

  async searchMessagesByUserAndFriend(
    userId: string,
    friendId: string,
    keyword: string
  ) {
    try {
      if (!userId || !friendId || !keyword) {
        throw new Error(
          "Missing required fields: userId, friendId, or keyword"
        );
      }

      const result = await messageRepository.searchMessagesByUserAndFriend(
        userId,
        friendId,
        keyword
      );

      return {
        messages: result.messages,
      };
    } catch (error: any) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }
  }
  async getMediaMessages(
    userId: string,
    friendId: string,
    exclusiveStartKey?: string
  ): Promise<{ messages: any[]; lastEvaluatedKey?: string }> {
    try {
      if (!userId || !friendId) {
        throw new Error("Missing required fields: userId or friendId");
      }

      const result = await messageRepository.getMediaMessages(
        userId,
        friendId,
        exclusiveStartKey
      );

      // Hàm kiểm tra xem một chuỗi có phải là URL không
      const isURL = (str: string) => {
        const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
        return urlPattern.test(str);
      };

      // Định dạng dữ liệu trước khi trả về
      const formattedMessages = result.messages
        .map((msg) => {
          let type;
          let url;
          let filename = null;
          let mimetype = null;
          let size = null;

          if (msg.contentType === "file") {
            const fileMessage = msg.message as FileMessage;
            type =
              fileMessage.mimetype && fileMessage.mimetype.startsWith("image/")
                ? "image"
                : "file";
            url = fileMessage.data; // Giả định data là URL
            filename = fileMessage.filename || null;
            mimetype = fileMessage.mimetype || null;
            size = fileMessage.size || null;
          } else if (
            msg.contentType === "text" &&
            typeof msg.message === "string" &&
            isURL(msg.message)
          ) {
            type = "link";
            url = msg.message;
          } else {
            return null; // Bỏ qua nếu không phải media
          }

          return {
            id: msg.id,
            type, // image, file, link
            url,
            filename,
            mimetype,
            size,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
          };
        })
        .filter((msg): msg is any => msg !== null); // Loại bỏ các tin nhắn không hợp lệ

      return {
        messages: formattedMessages,
        lastEvaluatedKey: result.lastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get media messages: ${error.message}`);
    }
  }
  // Thêm phương thức để lấy tin nhắn theo conversationId (chat nhóm)
  async getByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<Message[] | null> {
    return await messageRepository.getMessagesByConversationId(
      conversationId,
      userId,
    );
  }

  async searchMesageByConversation(
    conversationId: string,
    userId: string,
    keyword: string
  ): Promise<{ messages: any[] }> {
    try {
      if (!conversationId || !userId || !keyword) {
        throw new Error(
          "Missing required fields: conversationId, userId, or keyword"
        );
      }

      // Kiểm tra xem cuộc trò chuyện có tồn tại không
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        throw new Error("Không tìm thấy cuộc trò chuyện");
      }

      // Kiểm tra xem userId có trong cuộc trò chuyện không
      if (!conversation.participantsIds.includes(userId)) {
        throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
      }

      const result = await messageRepository.searchMessagesByConversation(
        conversationId,
        userId,
        keyword
      );

      return {
        messages: result.messages,
      };
    } catch (error: any) {
      throw new Error(`Failed to search group messages: ${error.message}`);
    }
  }

  async getMediaMessagesByConversation(
    conversationId: string,
    userId: string,
    exclusiveStartKey?: string
  ): Promise<{ messages: any[]; lastEvaluatedKey?: string }> {
    try {
      if (!conversationId || !userId) {
        throw new Error("Missing required fields: conversationId or userId");
      }

      const conversation = await getConversation(conversationId);
      if (!conversation) {
        throw new Error("Không tìm thấy cuộc trò chuyện");
      }

      if (!conversation.participantsIds.includes(userId)) {
        throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
      }

      const result = await messageRepository.getMediaMessagesByConversation(
        conversationId,
        userId,
        exclusiveStartKey
      );

      console.log("result", result);

      const isURL = (str: string) => {
        const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
        return urlPattern.test(str);
      };

      const formattedMessages = result.messages
        .map((msg) => {
          let type;
          let url;
          let filename = null;
          let mimetype = null;
          let size = null;

          if (msg.contentType === "file") {
            const fileMessage = msg.message as FileMessage;
            type =
              fileMessage.mimetype && fileMessage.mimetype.startsWith("image/")
                ? "image"
                : "file";
            url = fileMessage.data;
            filename = fileMessage.filename || null;
            mimetype = fileMessage.mimetype || null;
            size = fileMessage.size || null;
          } else if (
            msg.contentType === "text" &&
            typeof msg.message === "string" &&
            isURL(msg.message)
          ) {
            type = "link";
            url = msg.message;
          } else {
            return null;
          }

          return {
            id: msg.id,
            type,
            url,
            filename,
            mimetype,
            size,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
            conversationId: msg.conversationId,
          };
        })
        .filter((msg): msg is any => msg !== null);

      return {
        messages: formattedMessages,
        lastEvaluatedKey: result.lastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get media messages: ${error.message}`);
    }
  }

  // Phương thức mới: Đánh dấu xóa lịch sử trò chuyện nhóm
  async markGroupChatAsDeleted(currentUserId: string, conversationId: string) {
    try {
      if (!currentUserId || typeof currentUserId !== "string") {
        throw new Error("currentUserId không hợp lệ");
      }

      if (!conversationId || typeof conversationId !== "string") {
        throw new Error("conversationId không hợp lệ");
      }

      // Kiểm tra xem cuộc trò chuyện có tồn tại không
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        throw new Error("Không tìm thấy cuộc trò chuyện");
      }

      // Kiểm tra xem người dùng có thuộc nhóm chat không
      if (!conversation.participantsIds.includes(currentUserId)) {
        throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
      }

      await messageRepository.markGroupMessagesAsDeleted(
        currentUserId,
        conversationId
      );
    } catch (error: any) {
      throw new Error(
        `Không thể đánh dấu xóa lịch sử trò chuyện nhóm: ${error.message}`
      );
    }
  }
}
