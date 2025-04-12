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
                const file = message.message as FileMessage;
                console.log("Received file.data:", !file.data, "Type:", typeof file.data,"file name: " ,file.filename);

                if (
                    typeof file !== "object" ||
                    !file.data ||
                    !file.filename
                ) {
                    throw new Error("File message must contain data, filename");
                }
                //Tự động gán size
                if (typeof file.data === "string") {
                    const uploadPath = path.join(__dirname, "../uploads");
                    await fs.promises.mkdir(uploadPath, { recursive: true });
                    // Nếu là base64
                    // Giả sử bạn có dữ liệu base64 và tên file
                    const base64Data = file.data; // từ socket
                    const buffer = Buffer.from(base64Data, "base64");
                    const filePath = path.join(__dirname, "../uploads", file.filename);
                   
                    // Ghi file ra đĩa
                    await fs.promises.writeFile(filePath, buffer);

                    // Lúc này bạn có thể lấy file size an toàn
                    const { size } = await fs.promises.stat(filePath);

                    file.size = size
                    file.data = buffer;

                    const type = await FileType.fromBuffer(buffer);
                    file.mimetype = type ? type.mime : "";
                } else if (Buffer.isBuffer(file.data)) {
                    const buffer = file.data;
                    file.size = buffer.length;
                    const type = await FileType.fromBuffer(buffer);
                    file.mimetype = type ? type.mime : "";
                }else {
                    throw new Error("Cannot determine file size.");
                }

               

                // Kiểm tra kiểu file hợp lệ
                const allowedMimeTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "video/mp4",
                    "video/quicktime"
                ];
                console.log(file)
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    throw new Error("Unsupported file type. Only image/video files are allowed.");
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
        if (!message.createdAt) {
            message.createdAt = new Date().toISOString();
        }

        if (!message.updatedAt) {
            message.updatedAt = message.createdAt;
        }
        if (message.contentType === "file") {
            const file: any = message.message;
            const urlFile = await S3Service.post({ buffer: file.data, originalname: file.filename })
            message.message = urlFile;
        }
        return messageRepository.post(message)

    }
    async getByReceiverId(userId: string, friendId: string, exclusiveStartKey: string): Promise<Message[] | null> {
        return await messageRepository.getMessagesByFriendId(userId, friendId, exclusiveStartKey);
    }
    async getLatestMessage(userId: string, friendId: string): Promise<Message | null> {
        return await messageRepository.getLatestMessage(userId, friendId);
    }
    async getById(messageId: string):Promise<Message | null>{
        return await messageRepository.getById(messageId)
    }
    async update(message: Message){
        await messageRepository.update(message)
    }

}