import request from "supertest";
import express from "express";
import { friendRoutes } from "../routes/friendRoutes";
import * as FriendService from "../services/FriendService";

// Mock middleware để inject req.auth
jest.mock("../middelwares/authenticateJWT", () => ({
  authenticateJWT: (req: any, res: any, next: any) => {
    req.auth = req.headers["x-mock-auth"]
      ? { sub: req.headers["x-mock-auth"] }
      : undefined;
    next();
  },
}));

jest.mock("../services/FriendService");

const app = express();
app.use(express.json());
app.use("/", friendRoutes);

describe("friendRoutes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. GET /get-friends/:userId
  describe("GET /get-friends/:userId", () => {
    it('VP: userId = "u123"', async () => {
      (FriendService.getFriendList as jest.Mock).mockResolvedValue([{ id: "f1", name: "Friend 1" }]);
      const res = await request(app).get("/get-friends/u123");
      expect(res.status).toBe(200);
      expect(res.body.friends).toEqual([{ id: "f1", name: "Friend 1" }]);
    });

    it('IP: userId = "notfound"', async () => {
      (FriendService.getFriendList as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get("/get-friends/notfound");
      expect(res.status).toBe(200); // hoặc 404 nếu bạn muốn
      expect(res.body.friends).toEqual([]);
    });

    it('IP: userId = "" (rỗng)', async () => {
      const res = await request(app).get("/get-friends/");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: userId = "u123" (lỗi hệ thống)', async () => {
      (FriendService.getFriendList as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app).get("/get-friends/u123");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to get friends");
    });
  });

  // 2. POST /add
  describe("POST /add", () => {
    it('VP: senderId = "u1", receiverId = "u2", message = "hi"', async () => {
      (FriendService.addFriend as jest.Mock).mockResolvedValue({ id: "f2", senderId: "u1", receiverId: "u2", message: "hi" });
      const res = await request(app)
        .post("/add")
        .send({ senderId: "u1", receiverId: "u2", message: "hi" });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: "f2", senderId: "u1", receiverId: "u2", message: "hi" });
    });

    it('IP: senderId = "", receiverId = "u2", message = "hi"', async () => {
      const res = await request(app)
        .post("/add")
        .send({ senderId: "", receiverId: "u2", message: "hi" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Missing senderId or receiverId");
    });

    it('IP: senderId = "u1", receiverId = "", message = "hi"', async () => {
      const res = await request(app)
        .post("/add")
        .send({ senderId: "u1", receiverId: "", message: "hi" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Missing senderId or receiverId");
    });

    it('IP: senderId = "u1", receiverId = "u2", message = "hi" (đã là bạn)', async () => {
      (FriendService.addFriend as jest.Mock).mockRejectedValue(
        new Error("Đã là bạn bè, không thể gửi lời mời kết bạn")
      );
      const res = await request(app)
        .post("/add")
        .send({ senderId: "u1", receiverId: "u2", message: "hi" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Đã là bạn bè, không thể gửi lời mời kết bạn");
    });

    it('IP: senderId = "u1", receiverId = "u2", message = "hi" (lỗi hệ thống)', async () => {
      (FriendService.addFriend as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/add")
        .send({ senderId: "u1", receiverId: "u2", message: "hi" });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to create friend");
    });
  });

  // 3. GET /requests/:userId
  describe("GET /requests/:userId", () => {
    it('VP: userId = "u123"', async () => {
      (FriendService.getPendingFriendRequests as jest.Mock).mockResolvedValue([{ id: "r1" }]);
      const res = await request(app)
        .get("/requests/u123")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(200);
      expect(res.body.requests).toEqual([{ id: "r1" }]);
    });

    it('IP: userId = "notfound"', async () => {
      (FriendService.getPendingFriendRequests as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get("/requests/notfound")
        .set("x-mock-auth", "notfound");
      expect(res.status).toBe(200);
      expect(res.body.requests).toEqual([]);
    });

    it('IP: userId = "" (rỗng)', async () => {
      const res = await request(app)
        .get("/requests/")
        .set("x-mock-auth", "u123");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: userId = "u123" (lỗi hệ thống)', async () => {
      (FriendService.getPendingFriendRequests as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/requests/u123")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to get pending friend requests");
    });
  });

  // 4. POST /accept/:userId
  describe("POST /accept/:userId", () => {
    it('VP: userId = "u123"', async () => {
      (FriendService.acceptFriendRequest as jest.Mock).mockResolvedValue({ id: "ok" });
      const res = await request(app)
        .post("/accept/u123")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "ok" });
    });

    it('IP: userId = "notfound"', async () => {
      (FriendService.acceptFriendRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/accept/notfound")
        .set("x-mock-auth", "notfound");
      expect([404, 500]).toContain(res.status);
    });

    it('IP: userId = "" (rỗng)', async () => {
      const res = await request(app)
        .post("/accept/")
        .set("x-mock-auth", "u123");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: userId = "u123" (lỗi hệ thống)', async () => {
      (FriendService.acceptFriendRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/accept/u123")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to accept friend request");
    });
  });

  // 5. POST /accept/:friendRequestId
  describe("POST /accept/:friendRequestId", () => {
    it('VP: friendRequestId = "fr123"', async () => {
      (FriendService.acceptFriendRequest as jest.Mock).mockResolvedValue({ id: "ok" });
      const res = await request(app)
        .post("/accept/fr123");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "ok" });
    });

    it('IP: friendRequestId = "notfound"', async () => {
      (FriendService.acceptFriendRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/accept/notfound");
      expect([404, 500]).toContain(res.status);
    });

    it('IP: friendRequestId = "" (rỗng)', async () => {
      const res = await request(app)
        .post("/accept/");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: friendRequestId = "fr123" (lỗi hệ thống)', async () => {
      (FriendService.acceptFriendRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/accept/fr123");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to accept friend request");
    });
  });

  // 6. DELETE /cancel/:id
  describe("DELETE /cancel/:id", () => {
    it('VP: id = "fr123"', async () => {
      (FriendService.cancelFriendRequest as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app)
        .delete("/cancel/fr123")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend request cancelled");
    });

    it('IP: id = "notfound"', async () => {
      (FriendService.cancelFriendRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .delete("/cancel/notfound")
        .set("x-mock-auth", "u1");
      expect([404, 500]).toContain(res.status);
    });

    it('IP: id = "" (rỗng)', async () => {
      const res = await request(app)
        .delete("/cancel/")
        .set("x-mock-auth", "u1");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: id = "fr123" (lỗi hệ thống)', async () => {
      (FriendService.cancelFriendRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .delete("/cancel/fr123")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to cancel friend request");
    });
  });

  // 7. DELETE /cancel?senderId&receiverId
  describe("DELETE /cancel?senderId&receiverId", () => {
    it('VP: senderId = "u1", receiverId = "u2"', async () => {
      (FriendService.cancelFriendRequestListFriend as jest.Mock).mockResolvedValue(undefined);
      const res = await request(app)
        .delete("/cancel")
        .set("x-mock-auth", "u1")
        .query({ senderId: "u1", receiverId: "u2" });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend request cancelled");
    });

    it('IP: senderId = "", receiverId = "u2"', async () => {
      const res = await request(app)
        .delete("/cancel")
        .set("x-mock-auth", "u1")
        .query({ senderId: "", receiverId: "u2" });
      expect(res.status).toBe(400);
    });

    it('IP: senderId = "u1", receiverId = ""', async () => {
      const res = await request(app)
        .delete("/cancel")
        .set("x-mock-auth", "u1")
        .query({ senderId: "u1", receiverId: "" });
      expect(res.status).toBe(400);
    });

    it('IP: senderId = "u1", receiverId = "u2" (lỗi hệ thống)', async () => {
      (FriendService.cancelFriendRequestListFriend as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .delete("/cancel")
        .set("x-mock-auth", "u1")
        .query({ senderId: "u1", receiverId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to cancel friend request");
    });
  });

  // 8. GET /check-pending-request?senderId&receiverId
  describe("GET /check-pending-request", () => {
    it('VP: senderId = "u1", receiverId = "u2"', async () => {
      (FriendService.checkPendingRequest as jest.Mock).mockResolvedValue(true);
      const res = await request(app)
        .get("/check-pending-request")
        .query({ senderId: "u1", receiverId: "u2" });
      expect(res.status).toBe(200);
      expect(res.body.isPending).toBe(true);
    });

    it('IP: senderId = "", receiverId = "u2"', async () => {
      const res = await request(app)
        .get("/check-pending-request")
        .query({ senderId: "", receiverId: "u2" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/bắt buộc/);
    });

    it('IP: senderId = "u1", receiverId = ""', async () => {
      const res = await request(app)
        .get("/check-pending-request")
        .query({ senderId: "u1", receiverId: "" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/bắt buộc/);
    });

    it('IP: senderId = "u1", receiverId = "u2" (lỗi hệ thống)', async () => {
      (FriendService.checkPendingRequest as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/check-pending-request")
        .query({ senderId: "u1", receiverId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/lỗi|fail/i);
    });
  });

  // 9. GET /
  describe("GET /", () => {
    it('VP: Token hợp lệ ("u123")', async () => {
      (FriendService.getFriendListAccept as jest.Mock).mockResolvedValue([{ id: "f1", name: "Friend 1" }]);
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(200);
      expect(res.body.friends).toEqual([{ id: "f1", name: "Friend 1" }]);
    });

    it("IP: Không có token", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });

    it("IP: Token hợp lệ nhưng lỗi hệ thống", async () => {
      (FriendService.getFriendListAccept as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to get friends");
    });
  });
});