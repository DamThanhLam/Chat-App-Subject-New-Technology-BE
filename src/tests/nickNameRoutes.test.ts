import request from "supertest";
import express from "express";
import router from "../routes/nickNamRoutes";
import * as nicknameService from "../services/NickNamService";

// Mock service
jest.mock("../services/NickNamService");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  (req as any).auth = req.headers["x-mock-auth"]
    ? { sub: req.headers["x-mock-auth"] as string }
    : undefined;
  next();
});
app.use("/", router);

describe("nickNamRoutes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. POST /set/:targetUserId
  describe("POST /set/:targetUserId", () => {
    it('VP: userId = "u1", targetUserId = "u2", nickname = "Bạn thân"', async () => {
      (nicknameService.setNickname as jest.Mock).mockResolvedValue({ success: true });
      const res = await request(app)
        .post("/set/u2")
        .set("x-mock-auth", "u1")
        .send({ nickname: "Bạn thân" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('IP: không có userId (thiếu token)', async () => {
      const res = await request(app)
        .post("/set/u2")
        .send({ nickname: "Bạn thân" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu targetUserId', async () => {
      const res = await request(app)
        .post("/set/")
        .set("x-mock-auth", "u1")
        .send({ nickname: "Bạn thân" });
      expect([400, 404]).toContain(res.status);
    });

    it('IP: thiếu nickname', async () => {
      const res = await request(app)
        .post("/set/u2")
        .set("x-mock-auth", "u1")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('IP: lỗi hệ thống', async () => {
      (nicknameService.setNickname as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .post("/set/u2")
        .set("x-mock-auth", "u1")
        .send({ nickname: "Bạn thân" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });

  // 2. GET /get/:targetUserId
  describe("GET /get/:targetUserId", () => {
    it('VP: userId = "u1", targetUserId = "u2"', async () => {
      (nicknameService.getNickname as jest.Mock).mockResolvedValue({ nickname: "Bạn thân" });
      const res = await request(app)
        .get("/get/u2")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ nickname: "Bạn thân" });
    });

    it('IP: không có userId (thiếu token)', async () => {
      const res = await request(app)
        .get("/get/u2");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('IP: thiếu targetUserId', async () => {
      const res = await request(app)
        .get("/get/")
        .set("x-mock-auth", "u1");
      expect([400, 404]).toContain(res.status);
    });

    it('IP: lỗi hệ thống', async () => {
      (nicknameService.getNickname as jest.Mock).mockRejectedValue(new Error("fail"));
      const res = await request(app)
        .get("/get/u2")
        .set("x-mock-auth", "u1");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("fail");
    });
  });
});