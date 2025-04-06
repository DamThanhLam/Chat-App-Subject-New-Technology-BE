import { Socket } from "socket.io";
import { Server } from "socket.io";

export function handleChat(socket: Socket, io: Server): void {
  socket.on("chat:message", (msg: string) => {
    console.log("Message:", msg);
    io.emit("chat:message", msg);
  });
}
