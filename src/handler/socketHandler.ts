import { Server, Socket } from "socket.io";
import { handleChat } from "./chatHandler";

const users: Record<string, string> = {};

export function socketHandler(io: Server) {
  io.on("connection", (socket: Socket) => {
    // console.log(`User connected: ${socket.id}`);

    socket.on("join", (username: string) => {
      users[socket.id] = username;
      io.emit("user-list", Object.values(users));
    });
    handleChat(socket, io);

    // socket.on("group-message", (message: string) => {
    //   io.emit("group-message", { user: users[socket.id], message });
    // });

    // socket.on(
    //   "private-message",
    //   ({
    //     receiverName,
    //     message,
    //   }: {
    //     receiverName: string;
    //     message: string;
    //   }) => {
    //     const receiverId = getSocketIdByUsername(receiverName);
    //     receiverId &&
    //       io
    //         .to(receiverId)
    //         .emit("private-message", { sender: users[socket.id], message });
    //   }
    // );

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
