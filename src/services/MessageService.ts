import path from "path";
import fs from "fs";
import FileType from "file-type";
import S3Service from "../aws_service/s3.service";
import { FileMessage, Message } from "../models/Message";
import { MessageRepository } from "../repository/MessageRepository";

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
                if (typeof message.message !== "string" || message.message.trim() === "") {
                    throw new Error("Text message must be a non-empty string.");
                }
                break;

            case "emoji":
                if (typeof message.message !== "string" || !/^[\u{1F600}-\u{1F64F}]+$/u.test(message.message)) {
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

}