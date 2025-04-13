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
      console.log("users");
      console.log(users);
    });

    // handleChat(socket, io);

    // socket.on("group-message", (message: string) => {
    //   io.emit("group-message", { user: users[socket.id], message });
    // });

    socket.on("private-message", (message: Message) => {
      const user = (socket as any).user;

      const receiverSocketId = users[message.receiverId];

      message.senderId = user.sub;
      message.updatedAt = message.createdAt = new Date().toISOString();

      try {
        messageService.post(message);
        // Nếu tìm được người nhận thì gửi tin nhắn
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("private-message", {
            message,
          });
          socket.emit("result", { code: 200, message: "send message success" });
          return;
        } else {
          socket.emit("error", {
            error: "Receiver is not connected.",
            code: 405,
          });
          return;
        }
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Unknown error while sending message",
          code: 400,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`${users[socket.id]} disconnected.`);
      delete users[socket.id];
      io.emit("user-list", Object.values(users));
    });
  });
}

function getSocketIdByUsername(username: string): string | undefined {
  return Object.keys(users).find((socketId) => users[socketId] === username);
}
