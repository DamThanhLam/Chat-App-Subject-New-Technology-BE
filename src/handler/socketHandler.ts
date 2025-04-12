import { Server, Socket } from "socket.io";
import { handleChat } from "./chatHandler";
import { socketAuthMiddleware } from "../middelwares/authenticateJWT";
import { Message } from "../models/Message";
import upload_file from "../middelwares/upload_file";
import MessageService from "../services/MessageService";

const users: Record<string, string> = {};
const messageService = new MessageService();
export function socketHandler(io: Server) {
  io.use(socketAuthMiddleware);
  io.on("connection", (socket: Socket) => {

    socket.on("join", () => {
      const user = (socket as any).user;
      if (!user) {
        console.warn("User not authenticated properly");
        return;
      }

      users[user.sub] = socket.id;
      console.log("users")
      console.log(users)
    });

    // handleChat(socket, io);

    // socket.on("group-message", (message: string) => {
    //   io.emit("group-message", { user: users[socket.id], message });
    // });


    socket.on("private-message", (raw: string | object) => {
      let message: Message;

      if (typeof raw === "string") {
        try {
          message = JSON.parse(raw);
        } catch (e) {
          console.error("Invalid JSON:", e);
          return;
        }
      } else {
        message = raw as Message;
      }

      const user = (socket as any).user;
      message.senderId = user.sub;
      const receiverSocketId = users[message.receiverId];
      try {
        messageService.post(message)
        // Nếu tìm được người nhận thì gửi tin nhắn
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("private-message", {
            message,
          });
          socket.emit("result", { code: 200, message: "send message success" });
          return
        } else {
          socket.emit("error", { error: "Receiver is not connected.", code: 405 });
          return
        }
      } catch (error: any) {
        socket.emit("error", { error: error.message || "Unknown error while sending message", code: 400 });
      }

    });

    // Server-side code (Node.js with Socket.IO)
    socket.on("send-friend-request", (data) => {
      console.log("Received data:", data); // Kiểm tra dữ liệu truyền vào
    
      const user = (socket as any).user;
      const receiverSocketId = users[data.receiverId];
      
      if (!receiverSocketId) {
        socket.emit("error", { error: "Người nhận không online", code: 404 });
        return;
      }
    
      io.to(receiverSocketId).emit("new-friend-request", {
        fromUser: {
          id: user.sub,
          name: user.name,
          avatar: user.avatar,
        },
      });
    
      socket.emit("result", {
        code: 200,
        message: "Yêu cầu kết bạn đã được gửi.",
      });
    });
    
    


    // Lắng nghe sự kiện "accept-friend-request" để xử lý khi chấp nhận lời mời kết bạn
    socket.on("accept-friend-request", (data: any) => {
      const user = (socket as any).user;

      if (!user) {
        console.warn("User not authenticated properly");
        return;
      }

      console.log("Lời mời kết bạn được chấp nhận bởi:", data.accepter);

      // Cập nhật thông tin kết bạn vào cơ sở dữ liệu hoặc các logic khác tại đây

      // Gửi sự kiện "friend-request-accepted" đến client sau khi xử lý thành công
      io.emit("friend-request-accepted", { by: data.accepter });
      console.log("Đã phát sự kiện friend-request-accepted.");
    });

    socket.on("disconnect", () => {
      console.log(`${users[socket.id]} disconnected.`);
      const user = (socket as any).user;
      if (!user) {
        console.warn("User not authenticated properly");
        return;
      }
      delete users[user.sub];
      io.emit("user-list", Object.values(users));
    });
  });
}

function getSocketIdByUsername(username: string): string | undefined {
  return Object.keys(users).find((socketId) => users[socketId] === username);
}
