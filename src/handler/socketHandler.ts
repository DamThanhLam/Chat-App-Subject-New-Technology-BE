import { Server, Socket } from "socket.io";
import { handleChat } from "./chatHandler";
import { socketAuthMiddleware } from "../middelwares/authenticateJWT";
import { Message } from "../models/Message";
import upload_file from "../middelwares/upload_file";
import MessageService from "../services/MessageService";
import axios from "axios";

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

    socket.on("send-friend-request", async (data) => {
      const user = (socket as any).user;
    
      if (!user || !data?.receiverId) {
        socket.emit("send-friend-request-response", {
          code: 401,
          error: "Người dùng chưa được xác thực hoặc thiếu thông tin",
        });
        return;
      }
    
      console.log("📥 Gửi lời mời kết bạn từ:", user.sub);
      console.log("📥 Gửi lời mời đến:", data.receiverId);
    
      try {
        // 🛠 GỌI API /api/friends/add để lưu lời mời vào DB
        const response = await axios.post(
          "http://localhost:3000/api/friends/add",
          {
            senderId: user.sub, // 👈 thêm dòng này
            receiverId: data.receiverId,
            message: data.message || "",
          },
          {
            headers: {
              Authorization: `Bearer ${socket.handshake.auth.token}`,
            },
          }
        );        
    
        console.log("✅ Đã lưu lời mời kết bạn:", response.data);
    
        // Gửi socket event tới người nhận
        const receiverSocketId = users[data.receiverId];
        io.to(receiverSocketId || "").emit("new-friend-request", {
          fromUser: {
            id: user.sub,
            name: user.name,
            avatar: user.avatar || null,
          },
        });
    
        // Gửi phản hồi cho người gửi
        socket.emit("send-friend-request-response", {
          code: 200,
          message: "✅ Yêu cầu kết bạn đã được gửi",
          data: response.data, // hoặc senderId/receiverId
        });
    
      } catch (error: any) {
        console.error("❌ Không thể lưu lời mời kết bạn:", error?.response?.data || error.message);
    
        socket.emit("send-friend-request-response", {
          code: 500,
          error: "Không thể gửi lời mời kết bạn",
          detail: error?.response?.data || error.message,
        });
      }
    });
    
    
    
    

    socket.on("acceptFriendRequest", async (data) => {
      console.log("📨 Nhận acceptFriendRequest:", data);  // Debug data
    
      const { friendRequestId } = data;
      const token = socket.handshake.auth.token;
    
      if (!friendRequestId || !token) {
        console.log("❌ Thiếu friendRequestId hoặc token");
        socket.emit("acceptFriendRequestResponse", {
          code: 400,
          error: "Thiếu friendRequestId hoặc token",
        });
        return;
      }
    
      try {
        // Gọi API chấp nhận lời mời
        const response = await axios.post(
          `http://localhost:3000/api/friends/accept/${friendRequestId}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
    
        console.log("✅ Đã chấp nhận lời mời:", response.data);
        socket.emit("acceptFriendRequestResponse", {
          code: 200,
          message: "Đã chấp nhận lời mời",
          data: response.data,
        });
    
        // Gửi thông báo cho người gửi
        const senderSocketId = users[response.data.senderId];
        if (senderSocketId) {
          io.to(senderSocketId).emit("friendRequestAccepted", {
            fromUserId: response.data.receiverId,
          });
        }
      } catch (err: any) {
        console.error("❌ Không thể chấp nhận lời mời:", err?.response?.data || err.message);
        socket.emit("acceptFriendRequestResponse", {
          code: 500,
          error: "Không thể chấp nhận lời mời",
          detail: err?.response?.data || err.message,
        });
      }
    });
    
    
    

    // Lắng nghe sự kiện "decline-friend-request"
    socket.on("decline-friend-request", (data: any) => {
      const user = (socket as any).user;

      if (!user) {
        console.warn("User not authenticated properly");
        return;
      }

      const receiverSocketId = users[data.receiverId];
      
      if (!receiverSocketId) {
        socket.emit("error", { error: "Receiver is not online", code: 404 });
        return;
      }

      // Gửi sự kiện từ chối kết bạn cho người gửi
      io.to(receiverSocketId).emit("friend-request-declined", {
        by: user.sub,
      });

      // Gửi phản hồi cho người từ chối yêu cầu
      socket.emit("decline-friend-request-response", {
        code: 200,
        message: "You have declined the friend request.",
      });
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
