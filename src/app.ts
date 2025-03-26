import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { registerRoutes } from "./routes/registerRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { socketHandler } from "./handler/socketHandler";
import { friendRoutes } from "./routes/friendRoutes";
import dotenv from "dotenv";

dotenv.config(); // ✅ Load biến môi trường từ `.env`

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "views")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/ui-home.html"));
});
app.use(registerRoutes);
app.use(loginRoutes);
app.use("/api/friends", friendRoutes);

// Socket.IO
const server = http.createServer(app);
const io = new Server(server);
socketHandler(io);

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
