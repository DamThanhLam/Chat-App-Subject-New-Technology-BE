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
import * as conversationService from "../services/ConversationService";

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
      console.log(users)
      console.log("connection-------------------------------")

    });

    socket.on("join-group", async (conversationId: string) => {

      const user = (socket as any).user;
      if (!user) {
        console.error("Join-group event received from unauthenticated socket.");
        socket.emit("error", { error: "Unauthorized", code: 401 });
        return;
      }

      console.log(`User ${user.sub} requesting to join room: ${conversationId}`);
      if (!conversationId) {
        socket.emit("error", { error: "Missing conversationId to join", code: 400 });
        return;
      }

      try {
        const isMember = await joinedGroup(conversationId, user.sub);
        if (!isMember) {
          console.warn(`User ${user.sub} attempted to join room ${conversationId} but is not a member.`);
          socket.emit("error", { error: "Not a member of this group", code: 403 });
          return;
        }


        socket.join(conversationId);
        users[user.sub]?.rooms.add(conversationId);
        console.log(`User ${user.sub} successfully joined room: ${conversationId}`);
        socket.emit('room-joined', { conversationId: conversationId, success: true });

      } catch (error) {
        console.error(`Error joining room ${conversationId} for user ${user.sub}:`, error);
        socket.emit('room-join-error', { conversationId: conversationId, error: 'Failed to join room' });
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
          const targetSocket = users[participantId]?.socketId; // bạn cần tự xây hàm này
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
    socket.on('leave-room', async (roomId) => {
      const user = (socket as any).user;
      socket.leave(roomId);
      users[user.sub].rooms.delete(roomId);
      await leaveRoom(user.sub, roomId)
      socket.to(roomId).emit('userLeft', `${user.name} đã rời phòng ${roomId}`);
    });

    // Gửi tin nhắn đến 1 room
    // Handler cho tin nhắn nhóm
    socket.on('group-message', async (raw: string | object) => {
      // 1. Lấy thông tin người gửi (tương tự private-message)
      const user = (socket as any).user;
      if (!user) {
        console.error("Group-message event received from unauthenticated socket.");
        socket.emit("error", { error: "Unauthorized", code: 401 });
        return;
      }

      // 2. Phân tích cú pháp tin nhắn (tương tự private-message)
      let message: Message;
      try {
        message = typeof raw === "string" ? JSON.parse(raw) : raw as Message;
        // Kiểm tra conversationId cho tin nhắn nhóm
        if (!message.conversationId) {
          console.error("Missing conversationId in group message from user:", user.sub);
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
        console.warn(`User ${user.sub} attempted to send message to room ${message.conversationId} but is not in the socket room.`);
        // Trả về lỗi 403 nếu không có quyền gửi vào room này
        socket.emit("error", { error: "Not in group room", code: 403 });
        return;
      }
      // (Trong private-message, bước này được thay bằng việc tìm socket người nhận)

      // 4. Chuẩn bị dữ liệu tin nhắn trước khi lưu (tương tự private-message)
      try {
        message.senderId = user.sub; // Gán người gửi là user hiện tại
        message.createdAt = new Date().toISOString(); // Set timestamp server-side
        message.updatedAt = new Date().toISOString();
        message.status = "sended"; // Đặt trạng thái ban đầu (thường là sended từ phía người gửi)
        // (Trong private-message, status được set dựa trên trạng thái online của người nhận)


        // 5. Lưu tin nhắn vào Database (tương tự private-message)
        // messageService.post đã được sửa để xử lý cả tin nhắn riêng và nhóm
        const savedMessage = await messageService.post(message);

        if (!savedMessage) {
          console.error("Failed to save message to DB for user:", user.sub);
          socket.emit("error", { error: "Failed to save message", code: 500 });
          return;
        }

        console.log(`Broadcasting message ${savedMessage.id} to room ${message.conversationId} from user ${user.sub}`);

        // 6. Gửi/Broadcast tin nhắn (ĐIỂM KHÁC BIỆT CƠ BẢN VỚI private-message)
        // Thay vì gửi đến 1 socket cụ thể, broadcast đến tất cả các socket trong room của nhóm.
        io.to(message.conversationId).emit("group-message", {
          message: savedMessage, // Gửi đối tượng tin nhắn đã lưu (có ID, timestamp thật)
        });
        // (Trong private-message, bước này là io.to(receiverSocket.socketId).emit(...))

        // 7. Gửi kết quả về cho người gửi (tương tự private-message)
        // Thông báo cho người gửi rằng tin nhắn đã được xử lý thành công
        socket.emit("result", {
          code: 200,
          message: savedMessage // Gửi lại tin nhắn đã lưu cho Frontend cập nhật UI
        });
        // (Trong private-message, cũng gửi result về người gửi)


      } catch (error: any) {
        // Xử lý lỗi trong quá trình lưu/broadcast (tương tự private-message)
        console.error("Error handling group message:", error);
        socket.emit("error", {
          error: error.message || "Failed to process message",
          code: 500
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

      try {
        const message = await messageService.getById(messageId);

        if (!message) {
          socket.emit("error", { error: "Message not found to be recalled", code: 400 });
          return;
        }

        // Cập nhật trạng thái recall
        message.status = "recalled";
        message.message = "message recalled";

        await messageService.update(message);

        // Gửi lại tin nhắn recall cho chính người gửi
        socket.emit("message-recalled", { message });

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