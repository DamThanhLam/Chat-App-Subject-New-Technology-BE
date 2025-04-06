import express from "express";
import path from "path";
import http from "http";
<<<<<<< HEAD
import { Server } from "socket.io";
import { registerRoutes } from "./routes/registerRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { socketHandler } from "./handler/socketHandler";
import cors from 'cors';
import { friendRoutes } from "./routes/friendRoutes";
import dotenv from 'dotenv';
import groupChatRoutes from './routes/group-chat-routes';

dotenv.config();
const app = express();
app.use(express.json());
app.use('/api', groupChatRoutes);
=======
import { Server, Socket } from "socket.io";
import { registerRoutes } from "./routes/registerRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { socketHandler } from "./handler/socketHandler";
import groupRoutes from "./routes/groupRoutes";
const app = express();
app.use(express.json());
>>>>>>> origin/endpoint/create-link
app.use(express.static(path.join(__dirname, "views")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/ui-home.html"));
});
<<<<<<< HEAD
app.use(registerRoutes);
app.use(loginRoutes);
app.use("/api/friends", friendRoutes);
app.use('/api/group-chat', groupChatRoutes);
=======
app.use("/api", groupRoutes);
app.use(registerRoutes);
app.use(loginRoutes);

>>>>>>> origin/endpoint/create-link
// Socket.IO
const server = http.createServer(app);
const io = new Server(server);
socketHandler(io);

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
<<<<<<< HEAD

export default app;
=======
>>>>>>> origin/endpoint/create-link
