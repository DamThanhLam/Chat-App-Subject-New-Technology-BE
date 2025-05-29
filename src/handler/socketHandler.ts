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
import * as conversationService from "../services/ConversationService";
import { getConversation } from "../repository/ConversationRepository";
import { randomUUID } from "crypto";

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
      console.log(users);
      console.log("connection-------------------------------");
    });

    socket.on("join-group", async (conversationId: string) => {
      const user = (socket as any).user;
      if (!user) {
        console.error("Join-group event received from unauthenticated socket.");
        socket.emit("error", { error: "Unauthorized", code: 401 });
        return;
      }

      console.log(
        `User ${user.sub} requesting to join room: ${conversationId}`
      );
      if (!conversationId) {
        socket.emit("error", {
          error: "Missing conversationId to join",
          code: 400,
        });
        return;
      }

      try {
        const isMember = await joinedGroup(conversationId, user.sub);
        if (!isMember) {
          console.warn(
            `User ${user.sub} attempted to join room ${conversationId} but is not a member.`
          );
          socket.emit("error", {
            error: "Not a member of this group",
            code: 403,
          });
          return;
        }

        socket.join(conversationId);
        users[user.sub]?.rooms.add(conversationId);
        console.log(
          `User ${user.sub} successfully joined room: ${conversationId}`
        );
        socket.emit("room-joined", {
          conversationId: conversationId,
          success: true,
        });
      } catch (error) {
        console.error(
          `Error joining room ${conversationId} for user ${user.sub}:`,
          error
        );
        socket.emit("room-join-error", {
          conversationId: conversationId,
          error: "Failed to join room",
        });
      }
    });
    // handleChat(socket, io);

    // socket.on("group-message", (message: string) => {
    //   io.emit("group-message", { user: users[socket.id], message });
    // });

    socket.on("create-group", async (data: any) => {
      try {
        const user = (socket as any).user; // hoặc .id tùy theo cách bạn gắn
        if (!user) {
          return socket.emit("create-group-error", { error: "Unauthorized" });
        }

        const { participantIds, groupName } = data;

        if (!Array.isArray(participantIds)) {
          return socket.emit("create-group-error", {
            error: "Danh sách thành viên phải là mảng",
          });
        }

        const result = await conversationService.createGroupConversation(
          user.sub,
          participantIds,
          groupName
        );

        // Emit kết quả tạo nhóm thành công về client
        socket.emit("group-created", result);

        // Đồng thời có thể emit tới các thành viên khác trong nhóm nếu muốn:
        participantIds.forEach((participantId) => {

          if (participantId === user.sub) return

          const targetSocket = users[participantId]?.socketId; // bạn cần tự xây hàm này
          console.log(targetSocket);
          console.log("AAAAAA");
          console.log(users[participantId]);

          if (targetSocket) {
            io.to(targetSocket).emit("added-to-group", result);
          }
        });
      } catch (error: any) {
        console.error("Lỗi tạo nhóm:", error);
        socket.emit("create-group-error", { error: error.message });
      }
    });
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

      // Kiểm tra receiverId có hợp lệ không
      if (!message.receiverId) {
        socket.emit("error", {
          error: "receiverId is required for private messages",
          code: 422,
        });
        return;
      }

      const socketJoin = users[message.receiverId];
      message.status = socketJoin ? "received" : "sended";

      try {
        const messageResult = await messageService.post(message);

        // Nếu tìm được người nhận thì gửi tin nhắn
        if (socketJoin) {
          io.to(socketJoin.socketId).emit("private-message", {
            message,
          });
          socket.emit("result", { code: 200, message: messageResult });
        } else {
          socket.emit("result", { code: 405, message: messageResult });
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
    // Handler cho tin nhắn nhóm
    socket.on("group-message", async (raw: string | object) => {
      // 1. Lấy thông tin người gửi (tương tự private-message)
      const user = (socket as any).user;
      if (!user) {
        console.error(
          "Group-message event received from unauthenticated socket."
        );
        socket.emit("error", { error: "Unauthorized", code: 401 });
        return;
      }

      // 2. Phân tích cú pháp tin nhắn (tương tự private-message)
      let message: Message;
      try {
        message = typeof raw === "string" ? JSON.parse(raw) : (raw as Message);
        // Kiểm tra conversationId cho tin nhắn nhóm
        if (!message.conversationId) {
          console.error(
            "Missing conversationId in group message from user:",
            user.sub
          );
          socket.emit("error", { error: "Missing conversationId", code: 400 });
          return;
        }
      } catch (e) {
        console.error("Invalid message format from user", user.sub, ":", e);
        socket.emit("error", { error: "Invalid message format", code: 400 });
        return;
      }

      // 3. Kiểm tra quyền (ĐIỂM KHÁC BIỆT CƠ BẢN VỚI private-message)
      // Trong chat nhóm, cần kiểm tra người gửi có thuộc nhóm hay không.
      // Cách kiểm tra hiệu quả nhất ở Backend Socket là xem socket hiện tại có trong room của nhóm không.
      const isInSocketRoom = socket.rooms.has(message.conversationId);

      if (!isInSocketRoom) {
        console.warn(
          `User ${user.sub} attempted to send message to room ${message.conversationId} but is not in the socket room.`
        );
        // Trả về lỗi 403 nếu không có quyền gửi vào room này
        socket.emit("error", { error: "Not in group room", code: 403 });
        return;
      }

      const conversation = await conversationService.getConversationById(message.conversationId, user.sub)
      if (!conversation.permission.chat && conversation.leaderId !== user.sub) {
        console.log("cam chat")
        return
      }
      // (Trong private-message, bước này được thay bằng việc tìm socket người nhận)

      // 4. Chuẩn bị dữ liệu tin nhắn trước khi lưu (tương tự private-message)
      try {
        const sender = await userService.getUserById(user.sub)
        message.senderId = user.sub; // Gán người gửi là user hiện tại
        message.createdAt = new Date().toISOString(); // Set timestamp server-side
        message.updatedAt = new Date().toISOString();
        message.status = "sended";
        message.userName = sender ? sender.name : ""
        message.avatarUrl = sender ? sender.avatarUrl : ""

        // 5. Lưu tin nhắn vào Database (tương tự private-message)
        // messageService.post đã được sửa để xử lý cả tin nhắn riêng và nhóm
        const savedMessage = await messageService.post(message);

        if (!savedMessage) {
          console.error("Failed to save message to DB for user:", user.sub);
          socket.emit("error", { error: "Failed to save message", code: 500 });
          return;
        }

        console.log(
          `Broadcasting message ${savedMessage.id} to room ${message.conversationId} from user ${user.sub}`
        );

        // 6. Gửi/Broadcast tin nhắn (ĐIỂM KHÁC BIỆT CƠ BẢN VỚI private-message)
        // Thay vì gửi đến 1 socket cụ thể, broadcast đến tất cả các socket trong room của nhóm.
        io.to(message.conversationId).emit("group-message", {
          message: savedMessage, // Gửi đối tượng tin nhắn đã lưu (có ID, timestamp thật)
          conversationId: conversation.id
        });
        // (Trong private-message, bước này là io.to(receiverSocket.socketId).emit(...))

        // 7. Gửi kết quả về cho người gửi (tương tự private-message)
        // Thông báo cho người gửi rằng tin nhắn đã được xử lý thành công
        socket.emit("result", {
          code: 200,
          message: savedMessage, // Gửi lại tin nhắn đã lưu cho Frontend cập nhật UI
        });
        // (Trong private-message, cũng gửi result về người gửi)
      } catch (error: any) {
        // Xử lý lỗi trong quá trình lưu/broadcast (tương tự private-message)
        console.error("Error handling group message:", error);
        socket.emit("error", {
          error: error.message || "Failed to process message",
          code: 500,
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
        const userSocket = users[data.receiverId];
        userSocket && io.to(userSocket.socketId || "").emit("newFriendRequest", {
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

    socket.on("cancel-friend-request", async (data) => {
      const { senderId, receiverId } = data;
      console.log("Nhận yêu cầu hủy lời mời với senderId:", senderId, "và receiverId:", receiverId);

      if (!senderId || !receiverId) {
        socket.emit("cancel-friend-request-response", {
          code: 400,
          error: "Thiếu senderId hoặc receiverId",
        });
        return;
      }

      try {
        await FriendService.cancelFriendRequestListFriend(senderId, receiverId);

        socket.emit("cancel-friend-request-response", {
          code: 200,
          message: "Friend request cancelled",
        });
      } catch (error: any) {
        console.error("Lỗi khi hủy lời mời:", error);
        socket.emit("cancel-friend-request-response", {
          code: 500,
          error: error.message || "Failed to cancel friend request",
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
        if (senderSocketId && senderSocketId.socketId) {
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
      console.log("declineFriendRequestResponse")
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
        const user = users[cancelledRequest.senderId];
        if (user && user.socketId) {
          io.to(user.socketId).emit("friendRequestDeclined", {
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

      try {
        const message = await messageService.getById(messageId);

        if (!message) {
          socket.emit("error", {
            error: "Message not found to be recalled",
            code: 400,
          });
          return;
        }

        // Cập nhật trạng thái recall
        message.status = "recalled";
        message.message = "message recalled";

        await messageService.update(message);

        // Gửi lại tin nhắn recall cho chính người gửi
        socket.emit("message-recalled", { message });

        if (message.conversationId) {
          io.to(message.conversationId).emit("message-recalled", { message });
          return
        }

        // Gửi cho người nhận (nếu có receiverId và đang online)
        if (message.receiverId) {
          const socketJoin = users[message.receiverId];
          if (socketJoin?.socketId) {
            io.to(socketJoin.socketId).emit("message-recalled", { message });
          }
        }
      } catch (err: any) {
        console.error("Error recalling message:", err);
        socket.emit("error", {
          error: err.message || "Unknown error recalling message",
          code: 500,
        });
      }
    });

    socket.on("delete-message", async (messageId: string) => {
      const user = (socket as any).user;
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
    socket.on("invite-join-group",
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
          const userJoin = await userService.getUserById(newUserId);

          const userNameCurrent = await userService.getUserById(user.sub);


          const message: Message = {
            contentType: "notification",
            message: `${userJoin?.name} added the group by ${userNameCurrent?.name}`,
            senderId: "system",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageType: "group",
            status: "sended",
            conversationId: conversationId,
            id: randomUUID(),
            userName: "",
            avatarUrl: ""
          }
          if (!conversation) {
            socket.emit("response-invite-join-group", {
              code: 404,
              message: "Conversation not found",
              conversationId,
            });
            return;
          }

          if (conversation.participants.find(item => item.id === newUserId)) {
            socket.emit("response-invite-join-group", {
              code: 403,
              message: "User joined",
              conversationId,
            });
            return;
          }
          if (
            conversation.leaderId !== user.sub &&
            !(await conversationService.checkPermissionAutoJoin(conversationId))
          ) {
            if (conversation.requestJoin.find(item => item.id === newUserId)) {
              socket.emit("error", { message: "this user is waiting approval" })
              return
            }
            await conversationService.moveQueueRequestJoinConversation(conversationId, newUserId, user.sub)
            message.message = `${userNameCurrent?.name} has invited ${userJoin?.name} and is waiting to be accepted into the group.`
            const socketIdUserJoin = userJoin && users[userJoin.id]
            socketIdUserJoin && io.to(socketIdUserJoin.socketId).emit("waiting-accepted-into-group", { conversation })
            await messageService.post(message)

            io.to(conversationId).emit("userJoinedGroup", {
              conversationId,
              message: message,
              userJoin
            });
          } else {
            conversationService.autoJoinToGroup(conversation.id, newUserId, user.sub)
            const socketIdUserJoin = userJoin && users[userJoin.id]
            socketIdUserJoin && io.to(socketIdUserJoin.socketId).emit("notification-join-group", { conversation })
            messageService.post(message)

            io.to(conversationId).emit("userJoinedGroup", {
              conversationId,
              message: message,
              userJoin: userJoin
            });
          }


          // Emit sự kiện userJoinedGroup để thông báo thời gian thực




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
        const message: Message = {
          contentType: "notification",
          message: `${username?.name} was leaved`,
          senderId: "system",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageType: "group",
          status: "sended",
          conversationId: conversationId,
          id: randomUUID(),
          userName: "",
          avatarUrl: ""
        }
        messageService.post(message)
        // Emit sự kiện userLeft tới các thành viên còn lại trong nhóm
        io.to(conversationId).emit("userLeft", {
          userId,
          username: username?.username,
          conversationId,
          message
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

        console.log(conversationId);
        // Emit sự kiện group-renamed tới tất cả thành viên trong nhóm
        io.to(conversationId).emit("group-renamed", {
          conversationId,
          newName,
          leaderId: user.sub, // Gửi thêm thông tin về trưởng nhóm
        });
        socket.emit("group-renamed", {
          conversationId,
          newName,
          leaderId: user.sub,
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
          userJoin: { id: userId, method: username?.username },
        });
      } catch (error: any) {
        socket.emit("error", {
          error: error.message || "Error joining group",
          code: 500,
        });
      }
    });

    socket.on(
      "remove-user-from-group",
      async ({
        conversationId,
        userIdToRemove,
      }: {
        conversationId: string;
        userIdToRemove: string;
      }) => {
        const user = (socket as any).user;
        if (!user) {
          socket.emit("error", { error: "User not authenticated", code: 401 });
          return;
        }

        try {
          const conversation = await getConversation(conversationId);
          if (!conversation) {
            socket.emit("error", {
              error: "Conversation not found",
              code: 404,
            });
            return;
          }

          if (conversation.leaderId !== user.sub) {
            socket.emit("error", {
              error: "Only the group leader can remove members",
              code: 403,
            });
            return;
          }

          if (!conversation.participants.find(item => item.id === userIdToRemove)) {
            socket.emit("error", { error: "User not in group", code: 403 });
            return;
          }

          // Xóa thành viên khỏi nhóm
          await conversationService.removeUserFromGroup(
            conversationId,
            user.sub,
            userIdToRemove
          );
          const userRemove = await userService.getUserById(userIdToRemove)
          const userCurrent = await userService.getUserById(user.sub)


          const userSocket = users[userIdToRemove];
          if (userSocket && userSocket.socketId) {
            const socketToRemove = io.sockets.sockets.get(userSocket.socketId);
            if (socketToRemove) {
              socketToRemove.leave(conversationId);
              console.log(`User ${userIdToRemove} left room ${conversationId}`);
              io.to(userSocket.socketId).emit("removed-from-group", {
                conversationId,
                message: "Bạn đã bị xóa khỏi nhóm " + conversation.groupName,
              });
              console.log(`Emitted removed-from-group to ${userIdToRemove}`);
            } else {
              console.log(`Socket for user ${userIdToRemove} not found`);
            }
            // Cập nhật danh sách rooms trong users
            userSocket.rooms.delete(conversationId);
          } else {
            console.log(`User ${userIdToRemove} is not online`);
          }

          // Thông báo cho các thành viên còn lại trong nhóm
          const username = await userService.getUserName(userIdToRemove);
          const message: Message = {
            contentType: "notification",
            message: `${userCurrent?.name} removed ${userRemove?.name} fromt the group`,
            senderId: "system",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageType: "group",
            status: "sended",
            conversationId: conversationId,
            id: randomUUID(),
            userName: "",
            avatarUrl: ""
          }
          messageService.post(message)
          io.to(conversationId).emit("userLeft", {
            userId: userIdToRemove,
            username: username?.username || "Unknown",
            conversationId,
            message
          });

          // socket.emit("response-remove-user", {
          //   code: 200,
          //   message: "Đã xóa thành viên khỏi nhóm",
          //   userId: userIdToRemove,
          // });
        } catch (error: any) {
          socket.emit("error", {
            error: error.message || "Error removing user from group",
            code: 500,
          });
        }
      }
    );
    socket.on("get-approval-status", async (conversationId: string) => {
      console.log("Received get-approval-status event for conversationId:", conversationId);
      try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          console.log("Conversation not found:", conversationId);
          socket.emit("error", { error: "Conversation not found", code: 404 });
          return;
        }
        socket.emit("approval-status", {
          conversationId,
          isApprovalRequired: conversation.permission.acceptJoin,
        });
      } catch (error: any) {
        console.error("Error fetching approval status:", error.message);
        socket.emit("error", { error: error.message || "Failed to fetch approval status", code: 500 });
      }
    });

    socket.on("toggle-approval", async (data: { conversationId: string; isApprovalRequired: boolean }) => {
      console.log("Received toggle-approval event for conversationId:", data.conversationId);
      try {
        const user = (socket as any).user;
        if (!user) {
          console.log("User not authenticated for toggle-approval");
          socket.emit("error", { error: "User not authenticated", code: 401 });
          return;
        }

        console.log("User authenticated:", user.sub);

        const updatedConversation = await conversationService.toggleAcceptJoin(
          data.conversationId,
          user.sub
        );

        console.log("Updated conversation:", updatedConversation);

        io.to(data.conversationId).emit("approval-status-updated", {
          conversationId: data.conversationId,
          isApprovalRequired: updatedConversation.permission.acceptJoin,
        });
      } catch (error: any) {
        console.error("Error toggling approval status:", error.message);
        socket.emit("error", { error: error.message || "Failed to toggle approval status", code: 500 });
      }
    });
    socket.on("approve-into-group", async ({ conversationId, userId, decision }) => {
      const user = (socket as any).user;
      const conversation = await conversationService.getConversationById(conversationId, user.sub)
      if (!conversation.leaderId == userId) {
        socket.emit("error", { code: 400 })
      }
      const userJoin = await userService.getUserById(userId)
      const socketIdUserJoin = userJoin && users[userJoin.id]

      const message: Message = {
        contentType: "notification",
        message: `${userJoin?.name} joined`,
        senderId: "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageType: "group",
        status: "sended",
        conversationId: conversationId,
        id: randomUUID(),
        userName: "",
        avatarUrl: ""
      }
      if (decision) {
        messageService.post(message)
        conversationService.acceptJoinGroup(conversationId, userId)
        io.to(conversationId).emit("reponse-approve-into-group", {
          message: message,
          userJoin: userJoin,
          decision,
          conversationId
        });
        socketIdUserJoin && io.to(socketIdUserJoin.socketId).emit("reponse-approve-into-group", { reject: true })

      } else {
        message.message = `${userJoin?.name} rejected`
        messageService.post(message)
        conversationService.rejectJoinGroup(conversationId, userId)
        io.to(conversationId).emit("reponse-approve-into-group", {
          message: message,
          decision,
          conversationId
        });
        socketIdUserJoin && io.to(socketIdUserJoin.socketId).emit("reponse-approve-into-group", { accept: true, conversation: conversationService.getConversationById(conversationId, user.sub) })

      }
    })
    socket.on("block-chatting", async ({ conversationId, isChatting }) => {
      const user = (socket as any).user;
      const conversation = await conversationService.getConversationById(conversationId, user.sub)
      if (!conversation.leaderId == user.sub) {
        socket.emit("error", { code: 400 })
      }
      conversation.permission.chat = isChatting
      conversationService.updateConversation(conversationId, { permission: conversation.permission })
      io.to(conversationId).emit("block-chatting", { isChatting, conversationId })
    })


    //Socket Read Message and Delete Friend 28-5-2025
    socket.on("read-message", async (messageId: string) => {
      const user = (socket as any).user;
      try {
        // Lấy tin nhắn theo messageId
        const message = await messageService.getById(messageId);
        if (!message) return;

        // Chỉ thực hiện cập nhật nếu người đọc không phải là người gửi
        if (message.senderId !== user.sub) {
          // Nếu field readed chưa tồn tại, khởi tạo là mảng rỗng
          if (!message.readed) {
            message.readed = [];
          }
          // Thêm userId vào mảng readed nếu chưa có
          if (!message.readed.includes(user.sub)) {
            message.readed.push(user.sub);
          }
          // Nếu có ít nhất 1 người đọc, bạn có thể cập nhật status thành "readed"
          message.status = "readed";
          // Lưu cập nhật tin nhắn vào DB
          await messageService.update(message);

          // Gửi thông báo cập nhật trạng thái tới người gửi (nếu đang online)
          const senderSocket = users[message.senderId];
          if (senderSocket) {
            io.to(senderSocket.socketId).emit("message-read", { message });
          }
        }
      } catch (error: any) {
        console.error("Error updating read message:", error.message);
      }
    });

    //28-5-2025
    socket.on("delete-friend", async (data: { userId: string; friendId: string }) => {
      try {
        console.log("Nhận yêu cầu xóa bạn:", data);
        // Gọi service để xóa bạn khỏi database
        await FriendService.deleteFriend(data.userId, data.friendId);
        console.log(`Đã xóa bạn: ${data.userId} <-> ${data.friendId}`);
        
        // Gửi sự kiện 'friend-deleted' tới cả 2 bên
        // Giả sử bạn đang quản lý các socket đang kết nối trong biến "users"
        const senderSocket = users[data.userId];
        const receiverSocket = users[data.friendId];
        
        // Phát sự kiện cho người gửi
        if (senderSocket) {
          io.to(senderSocket.socketId).emit("friend-deleted", {
            deletedBy: data.userId,
            deletedUser: data.friendId,
          });
        }
        
        // Phát sự kiện cho người bị xóa
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit("friend-deleted", {
            deletedBy: data.userId,
            deletedUser: data.friendId,
          });
        }
      } catch (error: any) {
        console.error("Lỗi khi xóa bạn:", error.message);
        socket.emit("error", { error: error.message, code: 500 });
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
