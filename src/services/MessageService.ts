import S3Service from "../aws_service/s3.service";
import { Message } from "../models/Message";
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
                const file = message.message;

                if (
                    typeof file !== "object" ||
                    !file.data ||
                    !file.filename ||
                    !file.mimetype ||
                    typeof file.size !== "number"
                ) {
                    throw new Error("File message must contain data, filename, mimetype, and size.");
                }

                // Kiểm tra kiểu file hợp lệ
                const allowedMimeTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "video/mp4",
                    "video/quicktime"
                ];
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
        if (!message.creatAt) {
            message.creatAt = new Date().toISOString();
        }

        if (!message.updateAt) {
            message.updateAt = message.creatAt;
        }
        if (message.contentType === "file") {
            const file:any = message.message;
            const urlFile = await S3Service.post({ buffer: file.data, originalname: file.filename })
            message.message = urlFile;
        }
        return messageRepository.post(message)

    }

}