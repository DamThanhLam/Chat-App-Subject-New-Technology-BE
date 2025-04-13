import { Server, Socket } from "socket.io";
import { handleChat } from "./chatHandler";
import { socketAuthMiddleware } from "../middelwares/authenticateJWT";
import { Message } from "../models/Message";
import upload_file from "../middelwares/upload_file";
import MessageService from "../services/MessageService";
import * as FriendService from '../services/FriendService';
import axios from "axios";
import { declineFriendRequestById } from "../repository/FriendRepository";

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


    socket.on("private-message", async(raw: string | object) => {
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

      message.status=receiverSocketId ? "received": "sended"
      try {
        const messageResult = await messageService.post(message)
        // Nếu tìm được người nhận thì gửi tin nhắn
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("private-message", {
            message,
          });
          socket.emit("result", { code: 200, message: messageResult});
          return
        } else {
          socket.emit("result", { message: messageResult, code: 405 });
          return
        }
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Unknown error while sending message",
          code: 400,
        });
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
    
      console.log("Gửi lời mời kết bạn từ:", user.sub);
      console.log("Gửi lời mời đến:", data.receiverId);
    
      try {
        //GỌI API /api/friends/add để lưu lời mời vào DB
        const response = await axios.post(
          "http://localhost:3000/api/friends/add",
          {
            senderId: user.sub, 
            receiverId: data.receiverId,
            message: data.message || "",
          },
          {
            headers: {
              Authorization: `Bearer ${socket.handshake.auth.token}`,
            },
          }
        );        
    
        console.log("Đã lưu lời mời kết bạn:", response.data);
    
        // Gửi socket event tới người nhận
        const receiverSocketId = users[data.receiverId];
        io.to(receiverSocketId || "").emit("newFriendRequest", {
          id: response.data.id, // ID của lời mời
          senderId: user.sub,
          name: user.name,
          avatarUrl: user.avatar || "https://cdn-icons-png.flaticon.com/512/219/219983.png",
          createdAt: new Date().toISOString(),
        });
    
        // Gửi phản hồi cho người gửi
        socket.emit("send-friend-request-response", {
          code: 200,
          message: "Yêu cầu kết bạn đã được gửi",
          data: response.data, // hoặc senderId/receiverId
        });
    
      } catch (error: any) {
        console.error("Không thể lưu lời mời kết bạn:", error?.response?.data || error.message);
    
        socket.emit("send-friend-request-response", {
          code: 500,
          error: "Không thể gửi lời mời kết bạn",
          detail: error?.response?.data || error.message,
        });
      }
    });
    
    
    socket.on("acceptFriendRequest", async (data) => {
      const { friendRequestId } = data;
      const token = socket.handshake.auth.token;
    
      if (!friendRequestId || !token) {
        socket.emit("acceptFriendRequestResponse", {
          code: 400,
          error: "Thiếu friendRequestId hoặc token",
        });
        return;
      }
    
      try {
        // Chấp nhận lời mời kết bạn
        const updatedRequest = await FriendService.acceptFriendRequest(friendRequestId);
    
        // Thông báo cho cả hai người
        const senderSocketId = users[updatedRequest.senderId];
        const receiverSocketId = users[updatedRequest.receiverId];
    
        // Thông báo cho người nhận về việc chấp nhận lời mời
        if (senderSocketId) {
          io.to(senderSocketId).emit("friendRequestAccepted", {
            fromUserId: updatedRequest.receiverId,
          });
        }
    
        // Thông báo cho người gửi về việc chấp nhận
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("friendRequestAccepted", {
            fromUserId: updatedRequest.senderId,
          });
        }
    
        socket.emit("acceptFriendRequestResponse", {
          code: 200,
          message: "Đã chấp nhận lời mời",
          data: updatedRequest,
        });
      } catch (err: any) {
        console.error("Không thể chấp nhận lời mời:", err);
        socket.emit("acceptFriendRequestResponse", {
          code: 500,
          error: "Không thể chấp nhận lời mời",
          detail: err.message,
        });
      }
    });
    
    

    // Lắng nghe sự kiện "decline-friend-request"
    socket.on("declineFriendRequest", async (data) => {
      const { friendRequestId } = data;
      const token = socket.handshake.auth.token;
    
      if (!friendRequestId || !token) {
        socket.emit("declineFriendRequestResponse", {
          code: 400,
          error: "Thiếu friendRequestId hoặc token",
        });
        return;
      }
    
      try {
        // Hủy lời mời kết bạn
        const cancelledRequest = await FriendService.cancelFriendRequest(friendRequestId);
    
        // Kiểm tra nếu cancelledRequest trả về null, nghĩa là không tìm thấy yêu cầu kết bạn
        if (!cancelledRequest) {
          socket.emit("declineFriendRequestResponse", {
            code: 404,
            error: "Không tìm thấy lời mời kết bạn",
          });
          return;
        }
    
        // Thông báo cho người gửi về việc từ chối lời mời
        const senderSocketId = users[cancelledRequest.senderId];
        if (senderSocketId) {
          io.to(senderSocketId).emit("friendRequestDeclined", {
            fromUserId: cancelledRequest.receiverId,
          });
        }
    
        socket.emit("declineFriendRequestResponse", {
          code: 200,
          message: "Lời mời kết bạn đã bị từ chối",
          data: cancelledRequest,
        });
      } catch (err: any) {
        console.error("Không thể từ chối lời mời:", err);
        socket.emit("declineFriendRequestResponse", {
          code: 500,
          error: "Không thể từ chối lời mời",
          detail: err.message,
        });
      }
    });

    socket.on("recall-message",async(messageId:string)=>{
      const user = (socket as any).user;
      const message = await messageService.getById(messageId)
      if(message){
        message.status = "recalled"
        message.message="message recalled";
        messageService.update(message)
        const receiverSocketId = users[message.receiverId];
        receiverSocketId && io.to(receiverSocketId).emit("recall-message", {
          message: message
        })
        return
      }
      socket.emit("error", { error: "Message not found to be recalled", code: 400 });
    })
    socket.on("delete-message",async(messageId:string)=>{
      const user = (socket as any).user;
      const message = await messageService.getById(messageId)
      if(message){
        message.status = "deleted"
        message.message="message deleted";
        messageService.update(message)
        const receiverSocketId = users[message.receiverId];
        receiverSocketId && io.to(receiverSocketId).emit("delete-message", {
          messageId: messageId
        })
        return
      }
      socket.emit("error", { error: "Message not found to be recalled", code: 400 });
    })
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
