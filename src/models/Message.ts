export interface Message {
  id: string;
  conversationId: string | null;
  senderId: string;
  message: string | FileMessage;
  createdAt: string; // ISO string, nếu dùng `Date` thì phải convert từ backend
  updatedAt: string;
  parentMessage?: Message; // optional để tránh vòng lặp vô hạn
  readed: string[]; // Danh sách userId đã đọc
  messageType: "group" | "private";
  contentType: "file" | "emoji" | "text";
  receiverId: string;
  status: "recall" | "delete" | "readed" | "sended" | "received";
}
interface FileMessage {
  data: Buffer | string; // base64 string hoặc buffer
  filename: string;
  mimetype: string;
  size: number;
}
