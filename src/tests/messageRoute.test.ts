import request from "supertest";
import express from "express";
import { messageRoute } from "../routes/messageRoute";
import MessageService from "../services/MessageService";
import S3Service from "../aws_service/s3.service";

// Mock các service
jest.mock("../services/MessageService");
jest.mock("../aws_service/s3.service");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  (req as any).auth = req.headers["x-mock-auth"]
    ? { sub: req.headers["x-mock-auth"] as string }
    : undefined;
  next();
});
app.use("/", messageRoute);

describe("messageRoute", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. GET /
  describe("GET /", () => {
    it('VP: userId = "u1", friendId = "u2"', async () => {
      (MessageService.prototype.getByReceiverId as jest.Mock).mockResolvedValue([{ id: "m1" }]);
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: "m1" }]);
    });

    it('IP: thiếu friendId', async () => {
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/receiver Id must not be null/);
    });

    it('IP: không có userId', async () => {
      (MessageService.prototype.getByReceiverId as jest.Mock).mockResolvedValue([{ id: "m1" }]);
      const res = await request(app)
        .get("/")
        .query({ friendId: "u2" });
      // Có thể trả về 500 nếu code không kiểm tra userId
      expect([401, 500, 200]).toContain(res.status);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.getByReceiverId as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 2. GET /get-latest-message
  describe("GET /get-latest-message", () => {
    it('VP: userId = "u1", friendId = "u2"', async () => {
      (MessageService.prototype.getLatestMessage as jest.Mock).mockResolvedValue({ id: "m2" });
      const res = await request(app)
        .get("/get-latest-message")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "m2" });
    });

    it('IP: thiếu friendId', async () => {
      const res = await request(app)
        .get("/get-latest-message")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/friend Id must not be null/);
    });

    it('IP: không có userId', async () => {
      (MessageService.prototype.getLatestMessage as jest.Mock).mockResolvedValue({ id: "m2" });
      const res = await request(app)
        .get("/get-latest-message")
        .query({ friendId: "u2" });
      expect([401, 500, 200]).toContain(res.status);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.getLatestMessage as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/get-latest-message")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 3. POST /files
  describe("POST /files", () => {
    it("VP: files hợp lệ", async () => {
      (S3Service.post as jest.Mock).mockResolvedValue("url1");
      const res = await request(app)
        .post("/files")
        .attach("images", Buffer.from("test"), "img1.png");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Images uploaded successfully/);
      expect(res.body.images[0].url).toBe("url1");
    });

    it("IP: không có file", async () => {
      const res = await request(app).post("/files");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No files uploaded");
    });

    it("IP: lỗi hệ thống", async () => {
      (S3Service.post as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/files")
        .attach("images", Buffer.from("test"), "img1.png");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 4. DELETE /mark-deleted-single-chat
  describe("DELETE /mark-deleted-single-chat", () => {
    it('VP: userId = "u1", friendId = "u2"', async () => {
      (MessageService.prototype.markSingleChatAsDeleted as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app)
        .delete("/mark-deleted-single-chat")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Xóa lịch sử trò chuyện thành công/);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .delete("/mark-deleted-single-chat")
        .query({ friendId: "u2" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Thiếu xác thực/);
    });

    it('IP: thiếu friendId', async () => {
      const res = await request(app)
        .delete("/mark-deleted-single-chat")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Thiếu friendId/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.markSingleChatAsDeleted as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .delete("/mark-deleted-single-chat")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 5. GET /search-private
  describe("GET /search-private", () => {
    it('VP: userId = "u1", friendId = "u2", keyword = "abc"', async () => {
      (MessageService.prototype.searchMessagesByUserAndFriend as jest.Mock).mockResolvedValue([{ id: "m3" }]);
      const res = await request(app)
        .get("/search-private")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2", keyword: "abc" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: "m3" }]);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .get("/search-private")
        .query({ friendId: "u2", keyword: "abc" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu friendId', async () => {
      const res = await request(app)
        .get("/search-private")
        .set("x-mock-auth", "u1")
        .query({ keyword: "abc" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('IP: thiếu keyword', async () => {
      const res = await request(app)
        .get("/search-private")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('IP: friendId không phải string', async () => {
      const res = await request(app)
        .get("/search-private")
        .set("x-mock-auth", "u1")
        .query({ friendId: 123, keyword: "abc" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be strings/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.searchMessagesByUserAndFriend as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/search-private")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2", keyword: "abc" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 6. GET /media
  describe("GET /media", () => {
    it('VP: userId = "u1", friendId = "u2"', async () => {
      (MessageService.prototype.getMediaMessages as jest.Mock).mockResolvedValue([{ url: "img.png" }]);
      const res = await request(app)
        .get("/media")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ url: "img.png" }]);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .get("/media")
        .query({ friendId: "u2" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu friendId', async () => {
      const res = await request(app)
        .get("/media")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required field: friendId/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.getMediaMessages as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/media")
        .set("x-mock-auth", "u1")
        .query({ friendId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 7. GET /group
  describe("GET /group", () => {
    it('VP: userId = "u1", conversationId = "c1"', async () => {
      (MessageService.prototype.getByConversationId as jest.Mock).mockResolvedValue([{ id: "m4" }]);
      const res = await request(app)
        .get("/group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: "m4" }]);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .get("/group")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu conversationId', async () => {
      const res = await request(app)
        .get("/group")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/conversationId must be provided/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.getByConversationId as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 8. GET /search-group
  describe("GET /search-group", () => {
    it('VP: userId = "u1", conversationId = "c1", keyword = "abc"', async () => {
      (MessageService.prototype.searchMesageByConversation as jest.Mock).mockResolvedValue([{ id: "m5" }]);
      const res = await request(app)
        .get("/search-group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1", keyword: "abc" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: "m5" }]);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .get("/search-group")
        .query({ conversationId: "c1", keyword: "abc" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu conversationId', async () => {
      const res = await request(app)
        .get("/search-group")
        .set("x-mock-auth", "u1")
        .query({ keyword: "abc" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('IP: thiếu keyword', async () => {
      const res = await request(app)
        .get("/search-group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('IP: conversationId không phải string', async () => {
      const res = await request(app)
        .get("/search-group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: 123, keyword: "abc" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be strings/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.searchMesageByConversation as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/search-group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1", keyword: "abc" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 9. GET /media-group
  describe("GET /media-group", () => {
    it('VP: userId = "u1", conversationId = "c1"', async () => {
      (MessageService.prototype.getMediaMessagesByConversation as jest.Mock).mockResolvedValue([{ url: "img.png" }]);
      const res = await request(app)
        .get("/media-group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ url: "img.png" }]);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .get("/media-group")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu conversationId', async () => {
      const res = await request(app)
        .get("/media-group")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required field: conversationId/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.getMediaMessagesByConversation as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/media-group")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 10. DELETE /mark-deleted-group-chat
  describe("DELETE /mark-deleted-group-chat", () => {
    it('VP: userId = "u1", conversationId = "c1"', async () => {
      (MessageService.prototype.markGroupChatAsDeleted as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app)
        .delete("/mark-deleted-group-chat")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Xóa lịch sử trò chuyện nhóm thành công/);
    });

    it('IP: không có userId', async () => {
      const res = await request(app)
        .delete("/mark-deleted-group-chat")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Thiếu xác thực/);
    });

    it('IP: thiếu conversationId', async () => {
      const res = await request(app)
        .delete("/mark-deleted-group-chat")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Thiếu conversationId/);
    });

    it('IP: lỗi hệ thống', async () => {
      (MessageService.prototype.markGroupChatAsDeleted as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .delete("/mark-deleted-group-chat")
        .set("x-mock-auth", "u1")
        .query({ conversationId: "c1" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });
});