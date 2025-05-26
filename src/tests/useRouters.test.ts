import request from "supertest";
import express from "express";
import multer from "multer";
import { userRoutes } from "../routes/userRoutes";
import { UserService } from "../services/UserService";
import * as FriendService from "../services/FriendService";
import S3Service from "../aws_service/s3.service";

// Mock các service
jest.mock("../services/UserService");
jest.mock("../services/FriendService");
jest.mock("../aws_service/s3.service");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  (req as any).auth = req.headers["x-mock-auth"]
    ? { sub: req.headers["x-mock-auth"] as string }
    : undefined;
  next();
});

app.use("/", userRoutes);

describe("userRoutes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. PUT /
  describe("PUT /", () => {
    it('VP: userId = "u1", data hợp lệ', async () => {
      (UserService.prototype.updateUserInfo as jest.Mock).mockResolvedValue({ id: "u1", name: "User 1" });
      const res = await request(app)
        .put("/")
        .set("x-mock-auth", "u1")
        .send({ name: "User 1" });
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: "u1", name: "User 1" });
    });

    it("IP: không có userId (thiếu token)", async () => {
      const res = await request(app)
        .put("/")
        .send({ name: "User 1" });
      expect(res.status).toBe(404);
    });

    it("IP: userId = 'u1', data lỗi", async () => {
      (UserService.prototype.updateUserInfo as jest.Mock).mockRejectedValue(new Error("Update failed"));
      const res = await request(app)
        .put("/")
        .set("x-mock-auth", "u1")
        .send({ name: "" });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Update failed");
    });
  });

  // 2. GET /search
  describe("GET /search", () => {
    it('VP: email = "a@gmail.com"', async () => {
      (UserService.prototype.findUsersByEmail as jest.Mock).mockResolvedValue([{ id: "u1", email: "a@gmail.com" }]);
      const res = await request(app).get("/search?email=a@gmail.com");
      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([{ id: "u1", email: "a@gmail.com" }]);
    });

    it("IP: email rỗng", async () => {
      const res = await request(app).get("/search?email=");
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid email query");
    });

    it("IP: không có email", async () => {
      const res = await request(app).get("/search");
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid email query");
    });

    it("IP: email không tìm thấy", async () => {
      (UserService.prototype.findUsersByEmail as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get("/search?email=notfound@gmail.com");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No users found");
    });

    it("IP: email hợp lệ (lỗi hệ thống)", async () => {
      (UserService.prototype.findUsersByEmail as jest.Mock).mockRejectedValue(new Error("Something went wrong"));
      const res = await request(app).get("/search?email=a@gmail.com");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Something went wrong");
    });
  });

  // 3. GET /
  describe("GET /", () => {
    it('VP: userId = "u1"', async () => {
      (UserService.prototype.getUserById as jest.Mock).mockResolvedValue({ id: "u1", name: "User 1" });
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "u1", name: "User 1" });
    });

    it("IP: không có userId (thiếu token)", async () => {
      (UserService.prototype.getUserById as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app).get("/");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("IP: userId không tồn tại", async () => {
      (UserService.prototype.getUserById as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "notfound");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("IP: userId hợp lệ (lỗi hệ thống)", async () => {
      (UserService.prototype.getUserById as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 4. GET /friends/requests
  describe("GET /friends/requests", () => {
    it('VP: userId = "u1"', async () => {
      (FriendService.getPendingFriendRequests as jest.Mock).mockResolvedValue([{ id: "f1" }]);
      const res = await request(app)
        .get("/friends/requests")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body.requests).toEqual([{ id: "f1" }]);
    });

    it("IP: không có userId (thiếu token)", async () => {
      const res = await request(app).get("/friends/requests");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or missing token");
    });

    it("IP: userId hợp lệ (lỗi hệ thống)", async () => {
      (FriendService.getPendingFriendRequests as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/friends/requests")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to get friend requests");
    });
  });

  // 5. GET /friends
  describe("GET /friends", () => {
    it('VP: userId = "u1"', async () => {
      (FriendService.getFriendListAccept as jest.Mock).mockResolvedValue([{ id: "f1" }]);
      const res = await request(app)
        .get("/friends")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body.friends).toEqual([{ id: "f1" }]);
    });

    it("IP: không có userId (thiếu token)", async () => {
      const res = await request(app).get("/friends");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or missing token");
    });

    it("IP: userId hợp lệ (lỗi hệ thống)", async () => {
      (FriendService.getFriendListAccept as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/friends")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to get friends");
    });
  });

  // 6. GET /:id
  describe("GET /:id", () => {
    it('VP: id = "u1"', async () => {
      (UserService.prototype.getUserById as jest.Mock).mockResolvedValue({ id: "u1", name: "User 1" });
      const res = await request(app).get("/u1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "u1", name: "User 1" });
    });

    it('IP: id = "notfound"', async () => {
      (UserService.prototype.getUserById as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app).get("/notfound");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it('IP: id = "u1" (lỗi hệ thống)', async () => {
      (UserService.prototype.getUserById as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app).get("/u1");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 7. POST /avatar
  describe("POST /avatar", () => {
    it("VP: file hợp lệ", async () => {
      (S3Service.post as jest.Mock).mockResolvedValue("avatar_url");
      const res = await request(app)
        .post("/avatar")
        .attach("image", Buffer.from("test"), "avatar.png");
      expect(res.status).toBe(200);
      expect(res.body.avatar).toBe("avatar_url");
      expect(res.body.message).toBe("Avatar updated successfully");
    });

    it("IP: không có file", async () => {
      const res = await request(app).post("/avatar");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No file uploaded");
    });

    it("IP: lỗi upload (multer)", async () => {
      // Giả lập lỗi multer bằng cách gửi file quá lớn hoặc lỗi khác
      const uploadMock = jest.spyOn(multer.prototype, "single").mockImplementation(() => (req: any, res: any, next: any) => {
        next(new multer.MulterError("LIMIT_FILE_SIZE"));
      });
      const res = await request(app)
        .post("/avatar")
        .attach("image", Buffer.alloc(10), "avatar.png");
      expect(res.status).toBe(400);
      uploadMock.mockRestore();
    });

    it("IP: file hợp lệ (lỗi hệ thống)", async () => {
      (S3Service.post as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/avatar")
        .attach("image", Buffer.from("test"), "avatar.png");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });
});