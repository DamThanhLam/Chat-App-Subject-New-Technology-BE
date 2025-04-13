import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { registerRoutes } from "./routes/registerRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { socketHandler } from "./handler/socketHandler";
import cors from "cors";
import { friendRoutes } from "./routes/friendRoutes";
import dotenv from "dotenv";
import groupChatRoutes from "./routes/group-chat-routes";
import { groupRoutes } from "./routes/groupRoutes";
import { userRoutes } from "./routes/userRoutes";
import nicknameRoutes from "./routes/nickNamRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import { messageRoute } from "./routes/messageRoute";
import { expressjwt } from "express-jwt";
import { authenticateJWT } from "./middelwares/authenticateJWT";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "http://localhost:8081", // hoặc web app của bạn
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.options(
  "*",
  cors({
    origin: "http://localhost:8081",
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(express.json());

app.use(express.static(path.join(__dirname, "views")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/ui-home.html"));
});
app.use(registerRoutes);
app.use(loginRoutes);

// app.use('/api/group-chat', groupChatRoutes);
// app.use('/api',groupRoutes)
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Bearer <token>
    console.log("👉 JWT Token:", token);
  } else {
    console.warn("⚠️ No Authorization header found.");
  }

  next();
});
app.use("/api/user", authenticateJWT, userRoutes);
app.use("/api/nickname", authenticateJWT, nicknameRoutes);
app.use("/api/conversation", authenticateJWT, conversationRoutes);
app.use("/api/message", authenticateJWT, messageRoute);
app.use("/api/friends", authenticateJWT, friendRoutes);
// Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8081", // hoặc "*" để cho tất cả
    methods: ["GET", "POST"],
    credentials: true,
  },
});
socketHandler(io);
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err.name === "UnauthorizedError") {
      console.error("❌ express-jwt error:", err);
      return res.status(401).json({ message: "Invalid or missing token" });
    }
    console.error("❌ Unknown error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
);
server.listen(3000, "0.0.0.0", () => {
  console.log("Server is running on http://localhost:3000");
});

export default app;
