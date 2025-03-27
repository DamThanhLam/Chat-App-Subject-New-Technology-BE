// import express, { Request, Response } from "express";
// import { createServer } from "http";
// import { Server, Socket } from "socket.io";
// import path from "path";
// // import fs from "fs";
// // import jwt from "jsonwebtoken";
// // import jwkToPem from "jwk-to-pem";

// const app = express();
// app.use(express.json()); // Phân tích JSON
// const server = createServer(app);
// const io = new Server(server);

// // Lưu trữ danh sách user (socketId - username)
// const users: Record<string, string> = {};
// const database = [];
// app.use(express.static(path.join(__dirname, "views")));

// // Serve file index.html tại "/"
// app.get("/", (req: Request, res: Response) => {
//   res.sendFile(path.join(__dirname, "views", "/ui-home.html"));
// });
// app.get("/register", (req: Request, res: Response) => {
//   res.sendFile(path.join(__dirname, "./views/auth/register.html"));
// });

// app.post("/register", (req: Request, res: Response) => {
//   const { username, email, password } = req.body; // Giải cấu trúc từ req.body

//   if (!username || !email || !password) {
//     return res.status(400).json({ error: "All fields are required" });
//   }
//   const user = { username, email, password };
//   database.push(user);
//   console.log(user);
//   res.status(200).send({ code: 200, message: "Registration successful" });
// });
// app.get('/login',(req: Request, res: Response)=>(
//   res.sendfile(path.join(__dirname,"./views/auth/login.html"))
// ));
// // io.use((socket, next) => {
// //   const token = socket.handshake.auth.token.splice(7);
// //   const jwk = JSON.parse(fs.readFileSync("./jwks.json", "utf8")).keys[0];
// //   const pem = jwkToPem(jwk);
// //   jwt.verify(
// //     token,
// //     pem,
// //     { algorithms: ["RS256"] },
// //     function (err: any, decodedToken: any) {
// //       console.log(decodedToken);
// //       if (err) {
// //         next(new Error("Authentication error"));
// //       } else {
// //         next();
// //       }
// //     }
// //   );
// // });

// io.on("connection", (socket: Socket) => {
//   console.log(`User connected: ${socket.id}`);

//   socket.on("join", (username: string) => {
//     users[socket.id] = username;
//     console.log(`${username} joined the chat.`);
//     io.emit("user-list", Object.values(users)); // Gửi danh sách user cho mọi người
//   });

//   socket.on("group-message", (message: string) => {
//     io.emit("group-message", { user: users[socket.id], message });
//   });

//   socket.on(
//     "private-message",
//     ({ receiverName, message }: { receiverName: string; message: string }) => {
//       const receiverId = getSocketIdByUsername(receiverName);
//       console.log("receiverId: " + receiverId);
//       receiverId &&
//         io
//           .to(receiverId)
//           .emit("private-message", { sender: users[socket.id], message });
//     }
//   );

//   socket.on("disconnect", () => {
//     console.log(`${users[socket.id]} disconnected.`);
//     delete users[socket.id];
//     io.emit("user-list", Object.values(users));
//   });
// });

// server.listen(3000, () => {
//   console.log("Server is running on http://localhost:3000");
// });

// function getSocketIdByUsername(username: string): string | undefined {
//   return Object.keys(users).find((socketId) => users[socketId] === username);
// }
