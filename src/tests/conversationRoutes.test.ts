import request from "supertest";
import express from "express";
import conversationRoutes from "../routes/conversationRoutes";
import * as conversationService from "../services/ConversationService";

// Mock middleware để inject req.auth
jest.mock("../middelwares/authenticateJWT", () => ({
  authenticateJWT: (req: any, res: any, next: any) => {
    if (!req.headers["x-mock-auth"]) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing user authentication" });
    }
    req.auth = { sub: req.headers["x-mock-auth"] };
    next();
  },
}));

jest.mock("../services/ConversationService");

const app = express();
app.use(express.json());
app.use("/", conversationRoutes);

describe("conversationRoutes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. GET /:conversationId/approval-requests
  describe("GET /:conversationId/approval-requests", () => {
    it('VP: Có auth, conversationId = "c123"', async () => {
      (conversationService.getApprovalRequests as jest.Mock).mockResolvedValue([
        { id: "r1" },
      ]);
      const res = await request(app)
        .get("/c123/approval-requests")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body.requests).toEqual([{ id: "r1" }]);
    });

    it("IP: Không có auth", async () => {
      const res = await request(app).get("/c123/approval-requests");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it("IP: conversationId rỗng", async () => {
      const res = await request(app)
        .get("//approval-requests")
        .set("x-mock-auth", "u1");
      expect([400, 404]).toContain(res.status);
    });

    it("IP: Lỗi hệ thống", async () => {
      (conversationService.getApprovalRequests as jest.Mock).mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app)
        .get("/c123/approval-requests")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 2. POST /create-group
  describe("POST /create-group", () => {
    it("VP: Có auth, participantIds là mảng, groupName hợp lệ", async () => {
      (
        conversationService.createGroupConversation as jest.Mock
      ).mockResolvedValue({ id: "g1", name: "Nhóm 1" });
      const res = await request(app)
        .post("/create-group")
        .set("x-mock-auth", "u1")
        .send({ participantIds: ["u2", "u3"], groupName: "Nhóm 1" });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: "g1", name: "Nhóm 1" });
    });

    it("IP: Không có auth", async () => {
      const res = await request(app)
        .post("/create-group")
        .send({ participantIds: ["u2"], groupName: "Nhóm 1" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it("IP: participantIds không phải mảng", async () => {
      const res = await request(app)
        .post("/create-group")
        .set("x-mock-auth", "u1")
        .send({ participantIds: "u2", groupName: "Nhóm 1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/mảng/);
    });

    it("IP: Lỗi hệ thống", async () => {
      (
        conversationService.createGroupConversation as jest.Mock
      ).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/create-group")
        .set("x-mock-auth", "u1")
        .send({ participantIds: ["u2"], groupName: "Nhóm 1" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 3. GET /my-groups/:userId
  describe("GET /my-groups/:userId", () => {
    it('VP: Có auth, userId = "u123"', async () => {
      (
        conversationService.getConversationsOfUser as jest.Mock
      ).mockResolvedValue([{ id: "g1" }]);
      const res = await request(app)
        .get("/my-groups/u123")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: "g1" }]);
    });

    it("IP: Không có auth", async () => {
      const res = await request(app).get("/my-groups/u123");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it("IP: userId rỗng", async () => {
      const res = await request(app)
        .get("/my-groups/")
        .set("x-mock-auth", "u123");
      expect([400, 404]).toContain(res.status);
    });

    it("IP: Lỗi hệ thống", async () => {
      (
        conversationService.getConversationsOfUser as jest.Mock
      ).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/my-groups/u123")
        .set("x-mock-auth", "u123");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 4. PUT /add-users/:conversationId
  describe("PUT /add-users/:conversationId", () => {
    it('VP: Có auth, conversationId = "c123", newUserIds là mảng', async () => {
      (conversationService.addUsersToGroup as jest.Mock).mockResolvedValue({
        id: "c123",
        members: ["u1", "u2"],
      });
      const res = await request(app)
        .put("/add-users/c123")
        .set("x-mock-auth", "u1")
        .send({ newUserIds: ["u2"] });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/thành công/);
      expect(res.body.conversation).toEqual({
        id: "c123",
        members: ["u1", "u2"],
      });
    });

    it("IP: Không có auth", async () => {
      const res = await request(app)
        .put("/add-users/c123")
        .send({ newUserIds: ["u2"] });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it("IP: conversationId rỗng", async () => {
      const res = await request(app)
        .put("/add-users/")
        .set("x-mock-auth", "u1")
        .send({ newUserIds: ["u2"] });
      expect([400, 404]).toContain(res.status);
    });

    it("IP: newUserIds không phải mảng", async () => {
      const res = await request(app)
        .put("/add-users/c123")
        .set("x-mock-auth", "u1")
        .send({ newUserIds: "u2" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/array/);
    });

    it("IP: Lỗi hệ thống", async () => {
      (conversationService.addUsersToGroup as jest.Mock).mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app)
        .put("/add-users/c123")
        .set("x-mock-auth", "u1")
        .send({ newUserIds: ["u2"] });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 5. GET /:conversationId
  describe("GET /:conversationId", () => {
    it('VP: conversationId = "c123"', async () => {
      (conversationService.getConversationById as jest.Mock).mockResolvedValue({
        id: "c123",
        name: "Nhóm 1",
      });
      const res = await request(app).get("/c123");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "c123", name: "Nhóm 1" });
    });

    it("IP: conversationId không tồn tại", async () => {
      (conversationService.getConversationById as jest.Mock).mockResolvedValue(
        null
      );
      const res = await request(app).get("/notfound");
      expect(res.status).toBe(200); // hoặc 404 nếu bạn muốn
      expect(res.body).toBeNull();
    });

    it("IP: Lỗi hệ thống", async () => {
      (conversationService.getConversationById as jest.Mock).mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app).get("/c123");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 6. PUT /leave/:conversationId
  describe("PUT /leave/:conversationId", () => {
    it('VP: Có auth, conversationId = "c123"', async () => {
      (conversationService.leaveGroup as jest.Mock).mockResolvedValue(
        undefined
      );
      const res = await request(app)
        .put("/leave/c123")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Rời nhóm thành công/);
    });

    it("IP: Không có auth", async () => {
      const res = await request(app).put("/leave/c123");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it("IP: conversationId rỗng", async () => {
      const res = await request(app).put("/leave/").set("x-mock-auth", "u1");
      expect([400, 404]).toContain(res.status);
    });

    it("IP: Lỗi hệ thống", async () => {
      (conversationService.leaveGroup as jest.Mock).mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app)
        .put("/leave/c123")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 7. DELETE /delete/:conversationId
  describe("DELETE /delete/:conversationId", () => {
    it('VP: Có auth, conversationId = "c123"', async () => {
      (conversationService.deleteGroup as jest.Mock).mockResolvedValue(
        undefined
      );
      const res = await request(app)
        .delete("/delete/c123")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Xóa nhóm thành công/);
    });

    it("IP: Không có auth", async () => {
      const res = await request(app).delete("/delete/c123");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it("IP: conversationId rỗng", async () => {
      const res = await request(app)
        .delete("/delete/")
        .set("x-mock-auth", "u1");
      expect([400, 404]).toContain(res.status);
    });

    it("IP: Lỗi hệ thống", async () => {
      (conversationService.deleteGroup as jest.Mock).mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app)
        .delete("/delete/c123")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });
});
