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
        break;

      default:
        throw new Error("Invalid content type.");
    }

    // Gán thời gian nếu chưa có
    message.createdAt = new Date().toISOString();
    message.updatedAt = message.createdAt;
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
}
