import { Server, Socket } from "socket.io";
import { handleChat } from "./chatHandler";
import { socketAuthMiddleware } from "../middelwares/authenticateJWT";
import { Message } from "../models/Message";
import upload_file from "../middelwares/upload_file";
import MessageService from "../services/MessageService";
import * as FriendService from '../services/FriendService';
import axios from "axios";
import { declineFriendRequestById } from "../repository/FriendRepository";
import { autoJoinToGroup, checkPermissionAutoJoin, getConversationByLink, joinedGroup, leaveRoom, moveQueueRequestJoinConversation } from "../services/ConversationService";
import { UserService } from "../services/UserService";

const users: Record<string, { socketId: string, rooms: any }> = {};
const conversations: Record<string, string> = {}
const messageService = new MessageService();
const userService = new UserService()


export function socketHandler(io: Server) {

  io.use(socketAuthMiddleware);
  io.on("connection", (socket: Socket) => {
    socket.on("join", async () => {
      const user = (socket as any).user;
      users[user.sub] = { socketId: socket.id, rooms: new Set() };

      const infoUser = await userService.getUserById(user.sub)
      infoUser?.listConversation?.forEach(item => {
        socket.join(item);
        users[user.sub].rooms.add(item)
      })
    });


    // handleChat(socket, io);

    // socket.on("group-message", (message: string) => {
    //   io.emit("group-message", { user: users[socket.id], message });
    // });


    socket.on("private-message", async (raw: string | object) => {
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
      const { socketId } = users[message.receiverId];

      message.status = socketId ? "received" : "sended"
      try {
        const messageResult = await messageService.post(message)
        // Nếu tìm được người nhận thì gửi tin nhắn
        if (socketId) {
          io.to(socketId).emit("private-message", {
            message,
          });
          socket.emit("result", { code: 200, message: messageResult });
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
    // Rời khỏi room
    socket.on('leaveRoom', async (roomId) => {
      const user = (socket as any).user;
      socket.leave(roomId);
      users[user.sub].rooms.delete(roomId);
      await leaveRoom(user.sub, roomId)
      socket.to(roomId).emit('userLeft', `${user.name} đã rời phòng ${roomId}`);
    });

    // Gửi tin nhắn đến 1 room
    socket.on('group-message', async (raw: string | object) => {
      const user = (socket as any).user;
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
      message.senderId = user.sub;
      const roomCurrent = users[user.id].rooms.filter((item: any) => item === message.conversationId)
      message.status = roomCurrent ? "received" : "sended"

      const messageResult = await messageService.post(message)

      roomCurrent && io.to(roomCurrent).emit('group-message', {
        message: messageResult
      });
      socket.emit("result", { code: 200, message: messageResult });
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
        const { socketId } = users[data.receiverId];
        io.to(socketId || "").emit("newFriendRequest", {
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
        if (senderSocketId.socketId) {
          io.to(senderSocketId.socketId).emit("friendRequestAccepted", {
            fromUserId: updatedRequest.receiverId,
          });
        }

        // Thông báo cho người gửi về việc chấp nhận
        if (receiverSocketId.socketId) {
          io.to(receiverSocketId.socketId).emit("friendRequestAccepted", {
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
        const { socketId } = users[cancelledRequest.senderId];
        if (socketId) {
          io.to(socketId).emit("friendRequestDeclined", {
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

    socket.on("recall-message", async (messageId: string) => {
      const user = (socket as any).user;
      const message = await messageService.getById(messageId)
      if (message) {
        message.status = "recalled"
        message.message = "message recalled";
        messageService.update(message)
        socket.emit("message-recalled", { message: message });
        const { socketId } = users[message.receiverId];
        io.to(socketId).emit("message-recalled", { message: message });
        return
      }
      socket.emit("error", { error: "Message not found to be recalled", code: 400 });
    })
    socket.on("delete-message", async (messageId: string) => {
      const user = (socket as any).user;
      console.log(messageId)
      const message = await messageService.getById(messageId)
      if (message) {
        message.deletedBy ? "" : message.deletedBy = []
        message.deletedBy.push(user.sub)
        await messageService.update(message)
        socket.emit("message-deleted", { messageId: messageId });
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
    socket.on("invite-join-group", async (conversationId: string, newUserId: string) => {
      const user = (socket as any).user;
      if (await joinedGroup(conversationId, user.sub)) {
        io.emit("response-invite-join-group", { message: "you had joined this group" })
        return
      }
      const userNameCurrent = await userService.getUserName(user.sub);
      if (await checkPermissionAutoJoin(conversationId)) {
        const message = autoJoinToGroup(conversationId, newUserId, userNameCurrent)
        io.emit("response-invite-join-group", { message: message })
      } else {
        const message = moveQueueRequestJoinConversation(conversationId, newUserId, userNameCurrent)
        io.emit("response-invite-join-group", { message: message })
      }
    })
    // socket.on("link-join-group", async (link: string) => {
    //   const user = (socket as any).user;
    //   const conversation = await getConversationByLink(link)
    //   if (conversation) {
    //     if (await joinedGroup(conversation.id, user.sub)) {
    //       io.emit("response-invite-join-group", { message: "you had joined this group" })
    //       return
    //     }
    //     const userNameCurrent = await userService.getUserName(user.sub);
    //     if (await checkPermissionAutoJoin(conversation.id)) {
    //       const message = autoJoinToGroup(conversation.id, user.sub, "Join by link")
    //       io.emit("response-invite-join-group", { message: message })
    //     } else {
    //       const message = moveQueueRequestJoinConversation(conversation.id, user.sub, userNameCurrent)
    //       io.emit("response-invite-join-group", { message: message })
    //     }
    //   }
    // })

  });
}

