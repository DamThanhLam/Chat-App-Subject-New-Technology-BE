import { Server, Socket } from "socket.io";
import { handleChat } from "./chatHandler";
import { socketAuthMiddleware } from "../middelwares/authenticateJWT";
import { Message } from "../models/Message";
import upload_file from "../middelwares/upload_file";
import MessageService from "../services/MessageService";
import * as FriendService from "../services/FriendService";
import axios from "axios";
import { declineFriendRequestById } from "../repository/FriendRepository";
import {
  autoJoinToGroup,
  checkPermissionAutoJoin,
  deleteGroup,
  getConversationByLink,
  joinedGroup,
  leaveGroup,
  leaveRoom,
  moveQueueRequestJoinConversation,
  renameGroup,
} from "../services/ConversationService";
import { UserService } from "../services/UserService";
import {
  deleteConversation,
  getConversation,
} from "../repository/ConversationRepository";

const users: Record<string, { socketId: string; rooms: any }> = {};
const conversations: Record<string, string> = {};
const messageService = new MessageService();
const userService = new UserService();

export function socketHandler(io: Server) {
  io.use(socketAuthMiddleware);
  io.on("connection", (socket: Socket) => {
    socket.on("join", async () => {
      const user = (socket as any).user;
      users[user.sub] = { socketId: socket.id, rooms: new Set() };

      const infoUser = await userService.getUserById(user.sub);
      infoUser?.listConversation?.forEach((item) => {
        socket.join(item);
        users[user.sub].rooms.add(item);
      });
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

      message.status = socketId ? "received" : "sended";
      try {
        const messageResult = await messageService.post(message);
        // Nếu tìm được người nhận thì gửi tin nhắn
        if (socketId) {
          io.to(socketId).emit("private-message", {
            message,
          });
          socket.emit("result", { code: 200, message: messageResult });
          return;
        } else {
          socket.emit("result", { message: messageResult, code: 405 });
          return;
        }
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Unknown error while sending message",
          code: 400,
        });
      }
    });
    // Rời khỏi room
    socket.on("leave-room", async (roomId) => {
      const user = (socket as any).user;
      socket.leave(roomId);
      users[user.sub].rooms.delete(roomId);
      await leaveRoom(user.sub, roomId);
      socket.to(roomId).emit("userLeft", `${user.name} đã rời phòng ${roomId}`);
    });

    // Gửi tin nhắn đến 1 room
    socket.on("group-message", async (raw: string | object) => {
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
      const roomCurrent = users[user.id].rooms.filter(
        (item: any) => item === message.conversationId
      );
      message.status = roomCurrent ? "received" : "sended";

      const messageResult = await messageService.post(message);

      roomCurrent &&
        io.to(roomCurrent).emit("group-message", {
          message: messageResult,
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
          avatarUrl:
            user.avatar ||
            "https://cdn-icons-png.flaticon.com/512/219/219983.png",
          createdAt: new Date().toISOString(),
        });

        // Gửi phản hồi cho người gửi
        socket.emit("send-friend-request-response", {
          code: 200,
          message: "Yêu cầu kết bạn đã được gửi",
          data: response.data, // hoặc senderId/receiverId
        });
      } catch (error: any) {
        console.error(
          "Không thể lưu lời mời kết bạn:",
          error?.response?.data || error.message
        );

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
        const updatedRequest = await FriendService.acceptFriendRequest(
          friendRequestId
        );

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
        const cancelledRequest = await FriendService.cancelFriendRequest(
          friendRequestId
        );

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
      const message = await messageService.getById(messageId);
      if (message) {
        message.status = "recalled";
        message.message = "message recalled";
        messageService.update(message);
        socket.emit("message-recalled", { message: message });
        const { socketId } = users[message.receiverId];
        io.to(socketId).emit("message-recalled", { message: message });
        return;
      }
      socket.emit("error", {
        error: "Message not found to be recalled",
        code: 400,
      });
    });
    socket.on("delete-message", async (messageId: string) => {
      const user = (socket as any).user;
      console.log(messageId);
      const message = await messageService.getById(messageId);
      if (message) {
        message.deletedBy ? "" : (message.deletedBy = []);
        message.deletedBy.push(user.sub);
        await messageService.update(message);
        socket.emit("message-deleted", { messageId: messageId });
        return;
      }
      socket.emit("error", {
        error: "Message not found to be recalled",
        code: 400,
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
    // Mời tham gia nhóm
    socket.on(
      "invite-join-group",
      async (conversationId: string, newUserId: string) => {
        const user = (socket as any).user;
        if (!user) {
          socket.emit("response-invite-join-group", {
            code: 401,
            error: "User not authenticated",
            conversationId,
          });
          return;
        }

        try {
          // Kiểm tra quyền tham gia nhóm
          const conversation = await getConversation(conversationId);
          if (!conversation) {
            socket.emit("response-invite-join-group", {
              code: 404,
              message: "Conversation not found",
              conversationId,
            });
            return;
          }

          if (
            conversation.leaderId !== user.sub &&
            conversation.deputyId !== user.sub
          ) {
            socket.emit("response-invite-join-group", {
              code: 403,
              message: "Only the group leader or deputy can invite new members",
              conversationId,
            });
            return;
          }

          const username = await userService.getUserName(newUserId);
          const userNameCurrent = await userService.getUserName(user.sub);

          // Emit sự kiện userJoinedGroup để thông báo thời gian thực
          io.to(conversationId).emit("userJoinedGroup", {
            conversationId,
            user: { id: newUserId, method: username?.username },
          });

          socket.emit("response-invite-join-group", {
            code: 200,
            message: `${username?.username} added the group by ${userNameCurrent?.username}`,
            conversationId,
          });
        } catch (error: any) {
          socket.emit("response-invite-join-group", {
            code: 500,
            error: error.message || "Error inviting user to group",
            conversationId,
          });
        }
      }
    );

    // Xóa nhóm
    socket.on("delete-group", async (conversationId: string) => {
      const user = (socket as any).user;
      if (!user) {
        socket.emit("error", { error: "User not authenticated", code: 401 });
        return;
      }

      try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          socket.emit("error", { error: "Conversation not found", code: 404 });
          return;
        }
        // Xóa nhóm trong database
        await deleteGroup(conversationId, user.sub);

        // Thông báo tới từng thành viên trong nhóm
        conversation.participantsIds.forEach((participantId: string) => {
          const userSocket = users[participantId];
          if (userSocket && userSocket.socketId) {
            io.to(userSocket.socketId).emit("group-deleted", {
              conversationId,
            });
            console.log(
              `Notified user ${participantId} deleted of group deletion`
            );
            // Xóa conversationId khỏi rooms của user
            userSocket.rooms.delete(conversationId);
          } else {
            console.log(`User ${participantId} is not connected`);
          }
        });

        // Emit sự kiện group-deleted tới tất cả thành viên trong nhóm
        io.to(conversationId).emit("group-deleted", { conversationId });
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Error deleting group",
          code: 500,
        });
      }
    });

    // Rời phòng chat nhóm
    socket.on("leaveGroup", async ({ conversationId, userId }) => {
      const user = (socket as any).user;
      if (!user) {
        socket.emit("error", { error: "User not authenticated", code: 401 });
        return;
      }

      try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          socket.emit("error", { error: "Conversation not found", code: 404 });
          return;
        }

        // Kiểm tra xem người dùng có trong nhóm không
        if (!conversation.participantsIds.includes(userId)) {
          socket.emit("error", { error: "User not in group", code: 403 });
          return;
        }

        // Cập nhật danh sách thành viên trong database
        await leaveGroup(conversationId, userId);

        // Rời phòng socket
        socket.leave(conversationId);
        if (users[userId]) {
          users[userId].rooms.delete(conversationId);
        }
        console.log(`User ${userId} left group ${conversationId}`);
        const username = await userService.getUserName(userId);
        // Emit sự kiện userLeft tới các thành viên còn lại trong nhóm
        io.to(conversationId).emit("userLeft", {
          userId,
          username: username?.username,
          conversationId,
        });
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Error leaving group",
          code: 500,
        });
      }
    });

    // Đổi tên nhóm
    socket.on("rename-group", async ({ conversationId, newName }) => {
      const user = (socket as any).user;
      if (!user) {
        socket.emit("error", { error: "User not authenticated", code: 401 });
        return;
      }

      try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          socket.emit("error", { error: "Conversation not found", code: 404 });
          return;
        }

        if (conversation?.leaderId !== user.sub) {
          socket.emit("error", {
            error: "Only the group leader can rename the group",
            code: 403,
          });
          return;
        }

        // Cập nhật tên nhóm trong database
        await renameGroup(conversationId, newName);

        // Emit sự kiện group-renamed tới tất cả thành viên trong nhóm
        io.to(conversationId).emit("group-renamed", {
          conversationId,
          newName,
          leaderId: user.sub, // Gửi thêm thông tin về trưởng nhóm
        });
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Error renaming group",
          code: 500,
        });
      }
    });

    // Tham gia phòng chat nhóm
    socket.on("joinGroup", async ({ conversationId, userId }) => {
      socket.join(conversationId);
      users[userId]?.rooms.add(conversationId);
      console.log(`User ${userId} joined group ${conversationId}`);

      try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          socket.emit("error", { error: "Conversation not found", code: 404 });
          return;
        }
        const username = await userService.getUserName(userId);

        // Emit sự kiện userJoinedGroup tới tất cả thành viên trong phòng
        io.to(conversationId).emit("userJoinedGroup", {
          conversationId,
          user: { id: userId, method: username?.username },
        });
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Error joining group",
          code: 500,
        });
      }
    });

    // Thêm sự kiện group-created khi nhóm được tạo
    socket.on("group-created", async ({ conversationId }) => {
      try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          socket.emit("error", { error: "Conversation not found", code: 404 });
          return;
        }

        // Thêm tất cả thành viên vào phòng socket
        conversation.participantsIds.forEach((participantId: string) => {
          const userSocket = users[participantId];
          if (userSocket) {
            socket.join(conversationId);
            userSocket.rooms.add(conversationId);
            console.log(`User ${participantId} joined room ${conversationId}`);
          }
        });

        // Emit sự kiện group-created tới từng thành viên qua socketId
        conversation.participantsIds.forEach((participantId: string) => {
          const userSocket = users[participantId];
          if (userSocket && userSocket.socketId) {
            io.to(userSocket.socketId).emit("group-created", {
              conversationId,
              groupName: conversation.groupName,
              participants: conversation.participantsIds,
            });
            console.log(`Notified user ${participantId} of group creation`);
          } else {
            console.log(`User ${participantId} is not connected`);
          }
        });

        // Emit sự kiện tới phòng socket (cho các thành viên đã tham gia phòng)
        io.to(conversationId).emit("group-created", {
          conversationId,
          groupName: conversation.groupName,
          participants: conversation.participantsIds,
        });
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Error handling group creation",
          code: 500,
        });
      }
    });

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
