import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { registerRoutes } from "./routes/registerRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { socketHandler } from "./handler/socketHandler";
import cors from 'cors';
import { friendRoutes } from "./routes/friendRoutes";
import dotenv from 'dotenv';
import groupChatRoutes from './routes/group-chat-routes';
import { groupRoutes } from "./routes/groupRoutes";
import { userRoutes } from "./routes/userRoutes";
import { expressjwt } from "express-jwt";

import jwksRsa from"jwks-rsa";

dotenv.config();
const app = express();

const {
  AWS_REGION,
  USER_POOL_ID,
  CLIENT_ID,
  PORT
} = process.env;
app.use(cors({
  origin: "http://localhost:8081", // hoặc web app của bạn
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
}));
app.options("*", cors({
  origin: "http://localhost:8081",
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"]
}));
console.log(AWS_REGION)
app.use(express.json());
const authenticateJWT = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  }),
  audience: CLIENT_ID,
  issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`,
  algorithms: ["RS256"],
});

// app.use(express.static(path.join(__dirname, "views")));

// Routes
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "views/ui-home.html"));
// });
// app.use(registerRoutes);
// app.use(loginRoutes);
// app.use("/api/friends", friendRoutes);
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
app.use('/api/user',authenticateJWT, userRoutes)
// Socket.IO
const server = http.createServer(app);
const io = new Server(server);
socketHandler(io);
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.name === "UnauthorizedError") {
    console.error("❌ express-jwt error:", err);
    return res.status(401).json({ message: "Invalid or missing token" });
  }
  console.error("❌ Unknown error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});
server.listen(3000,'0.0.0.0', () => {
  console.log("Server is running on http://localhost:3000");
});

export default app;