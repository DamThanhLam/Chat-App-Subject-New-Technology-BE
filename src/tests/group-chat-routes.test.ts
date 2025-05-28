import request from "supertest";
import express from "express";
import router from "../routes/group-chat-routes";
import { GroupChatService } from "../services/group-chat-service";

// Mock service methods
jest.mock("../services/group-chat-service", () => ({
  GroupChatService: {
    createGroup: jest.fn((req, res) => res.status(201).json({ group: { id: "g1", name: req.body.name, members: req.body.members } })),
    updateGroup: jest.fn((req, res) => res.status(200).json({ group: { id: req.params.groupId, ...req.body } })),
    getGroupInfo: jest.fn((req, res) => res.status(200).json({ id: req.params.groupId, name: "Nhóm 1", members: ["u1"] })),
    sendMessage: jest.fn((req, res) => res.status(201).json({ message: { id: "m1", content: req.body.content, file: req.file?.originalname } })),
    getMessages: jest.fn((req, res) => res.status(200).json([{ id: "m1", content: "Hi" }])),
    addMemberToGroup: jest.fn((req, res) => res.status(201).json({ message: "Thêm thành viên thành công" })),
  }
}));

const app = express();
app.use(express.json());
app.use("/", router);

describe("group-chat-routes", () => {
  // 1. POST /groups
  describe("POST /groups", () => {
    it('VP: name và members hợp lệ', async () => {
      const res = await request(app)
        .post("/groups")
        .send({ name: "Nhóm 1", members: ["u1"] });
      expect(res.status).toBe(201);
      expect(res.body.group).toMatchObject({ name: "Nhóm 1", members: ["u1"] });
    });
  });

  // 2. PUT /groups/:groupId
  describe("PUT /groups/:groupId", () => {
    it('VP: groupId hợp lệ, body hợp lệ', async () => {
      const res = await request(app)
        .put("/groups/g1")
        .send({ name: "Nhóm mới" });
      expect(res.status).toBe(200);
      expect(res.body.group).toMatchObject({ id: "g1", name: "Nhóm mới" });
    });
  });

  // 3. GET /groups/:groupId
  describe("GET /groups/:groupId", () => {
    it('VP: groupId hợp lệ', async () => {
      const res = await request(app).get("/groups/g1");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: "g1", name: "Nhóm 1" });
    });
  });

  // 4. POST /groups/:groupId/messages
  describe("POST /groups/:groupId/messages", () => {
    it('VP: gửi message text', async () => {
      const res = await request(app)
        .post("/groups/g1/messages")
        .send({ content: "Hi" });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatchObject({ content: "Hi" });
    });

    it('VP: gửi message có file', async () => {
      const res = await request(app)
        .post("/groups/g1/messages")
        .attach("file", Buffer.from("test"), "test.txt")
        .field("content", "File gửi");
      expect(res.status).toBe(201);
      expect(res.body.message.file).toBe("test.txt");
    });
  });

  // 5. GET /groups/:groupId/messages
  describe("GET /groups/:groupId/messages", () => {
    it('VP: groupId hợp lệ', async () => {
      const res = await request(app).get("/groups/g1/messages");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("content");
    });
  });

  // 6. POST /groups/:groupId/members
  describe("POST /groups/:groupId/members", () => {
    it('VP: thêm thành viên', async () => {
      const res = await request(app)
        .post("/groups/g1/members")
        .send({ userId: "u2" });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/thành viên thành công/i);
    });
  });
});