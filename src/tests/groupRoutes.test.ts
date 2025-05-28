import request from "supertest";
import express from "express";
import { groupRoutes } from "../routes/groupRoutes";
import { UserService } from "../services/UserService";
import { GroupRepository } from "../repository/GroupRepository";

// Mock các service
jest.mock("../services/UserService");
jest.mock("../repository/GroupRepository");

const app = express();
app.use(express.json());
app.use("/", groupRoutes);

describe("groupRoutes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. POST /groups
  describe("POST /groups", () => {
    it('VP: name = "Nhóm 1"', async () => {
      (GroupRepository.prototype.createGroup as jest.Mock).mockReturnValue({
        id: "g1",
        name: "Nhóm 1",
        members: [],
        inviteLinks: [],
      });
      const res = await request(app)
        .post("/groups")
        .send({ name: "Nhóm 1" });
      expect(res.status).toBe(201);
      expect(res.body.group).toEqual({
        id: "g1",
        name: "Nhóm 1",
        members: [],
        inviteLinks: [],
      });
    });

    it("IP: name rỗng", async () => {
      const res = await request(app)
        .post("/groups")
        .send({ name: "" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Group name is required");
    });

    it("IP: không có name", async () => {
      const res = await request(app)
        .post("/groups")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Group name is required");
    });

    it('IP: name = "Nhóm 1" (lỗi hệ thống)', async () => {
      (GroupRepository.prototype.createGroup as jest.Mock).mockImplementation(() => {
        throw new Error("DB error");
      });
      const res = await request(app)
        .post("/groups")
        .send({ name: "Nhóm 1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("DB error");
    });
  });

  // 2. POST /groups/:groupId/create-link
  describe("POST /groups/:groupId/create-link", () => {
    it('VP: groupId = "g123"', async () => {
      (UserService.prototype.createInviteLink as jest.Mock).mockReturnValue("abc123");
      const res = await request(app)
        .post("/groups/g123/create-link");
      expect(res.status).toBe(201);
      expect(res.body.inviteLink).toBe("http://localhost:3000/api/join/abc123");
    });

    it("IP: groupId rỗng", async () => {
      const res = await request(app)
        .post("/groups//create-link");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: groupId không tồn tại', async () => {
      (UserService.prototype.createInviteLink as jest.Mock).mockImplementation(() => {
        throw new Error("Group not found");
      });
      const res = await request(app)
        .post("/groups/notfound/create-link");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Group not found");
    });

    it('IP: groupId = "g123" (lỗi hệ thống)', async () => {
      (UserService.prototype.createInviteLink as jest.Mock).mockImplementation(() => {
        throw new Error("DB error");
      });
      const res = await request(app)
        .post("/groups/g123/create-link");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("DB error");
    });
  });

  // 3. POST /groups/join/:link
  describe("POST /groups/join/:link", () => {
    it('VP: link = "abc123", userId = "u1"', async () => {
      (UserService.prototype.joinGroupWithLink as jest.Mock).mockReturnValue("Join group success");
      const res = await request(app)
        .post("/groups/join/abc123")
        .send({ userId: "u1" });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Join group success");
    });

    it('IP: link rỗng, userId = "u1"', async () => {
      const res = await request(app)
        .post("/groups/join/")
        .send({ userId: "u1" });
      expect([400, 404]).toContain(res.status);
    });

    it('IP: link = "abc123", userId rỗng', async () => {
      (UserService.prototype.joinGroupWithLink as jest.Mock).mockImplementation(() => {
        throw new Error("UserId is required");
      });
      const res = await request(app)
        .post("/groups/join/abc123")
        .send({ userId: "" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("UserId is required");
    });

    it('IP: link = "notfound", userId = "u1"', async () => {
      (UserService.prototype.joinGroupWithLink as jest.Mock).mockImplementation(() => {
        throw new Error("Link not found");
      });
      const res = await request(app)
        .post("/groups/join/notfound")
        .send({ userId: "u1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Link not found");
    });

    it('IP: link = "abc123", userId = "u1" (lỗi hệ thống)', async () => {
      (UserService.prototype.joinGroupWithLink as jest.Mock).mockImplementation(() => {
        throw new Error("DB error");
      });
      const res = await request(app)
        .post("/groups/join/abc123")
        .send({ userId: "u1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("DB error");
    });
  });
});