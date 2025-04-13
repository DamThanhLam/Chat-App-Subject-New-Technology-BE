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
        return messageRepository.post(message)

    }
    async getByReceiverId(userId: string, friendId: string, exclusiveStartKey: string): Promise<Message[] | null> {
        return await messageRepository.getMessagesByFriendId(userId, friendId, exclusiveStartKey);
    }
    async getLatestMessage(userId: string, friendId: string): Promise<Message | null> {
        return await messageRepository.getLatestMessage(userId, friendId);
    }
    async getById(messageId: string): Promise<Message | null> {
        return await messageRepository.getById(messageId)
    }
    async update(message: Message) {
        await messageRepository.update(message)
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
