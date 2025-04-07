import { Server, Socket } from "socket.io";

const users: Record<string, string> = {};
const userRooms: Record<string, string> = {};

export function socketHandler(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join", (username: string) => {
      users[socket.id] = username;
      io.emit("user-list", Object.values(users));
    });

    socket.on("group-message", (message: string) => {
      io.emit("group-message", { user: users[socket.id], message });
    });

    socket.on(
      "private-message",
      ({
        receiverName,
        message,
      }: {
        receiverName: string;
        message: string;
      }) => {
        const receiverId = getSocketIdByUsername(receiverName);
        receiverId &&
          io
            .to(receiverId)
            .emit("private-message", { sender: users[socket.id], message });
      }
    );

    // Tham gia nhóm chat (room)
    socket.on("join-room", (roomId: string) => {
      socket.join(roomId);
      userRooms[socket.id] = roomId;
      console.log(`${users[socket.id]} joined room ${roomId}`);
    });

    // Gửi tin nhắn trong nhóm (realtime)
    socket.on("group-message", ({ roomId, message }: { roomId: string; message: string }) => {
      const sender = users[socket.id];
      if (sender && roomId) {
        io.to(roomId).emit("group-message", {
          sender,
          message,
          roomId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`${users[socket.id]} disconnected.`);
      delete users[socket.id];
      delete userRooms[socket.id];
      io.emit("user-list", Object.values(users));
    });
  });
}

function getSocketIdByUsername(username: string): string | undefined {
  return Object.keys(users).find((socketId) => users[socketId] === username);
}
