import { Router } from "express";
import path from "path";
import { UserService } from "../services/user-service";
import jwt from "jsonwebtoken";

const userService = new UserService();
const router = Router();

router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/auth/login.html"));
});
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (await userService.login(email, password)) {
    const token = jwt.sign({ _id: email }, process.env.SECRET_TOKEN!, {
      expiresIn: "1h",
    });
    const refreshToken = jwt.sign({ id: email }, process.env.REFRESH_TOKEN!, {
      expiresIn: "7d",
    });
    // code client side
    // res.cookie("refreshToken", refreshToken, {
    //   httpOnly: true,      // Bảo mật, ngăn chặn truy cập từ JavaScript
    //   secure: true,        // Chỉ hoạt động trên HTTPS
    //   sameSite: "strict",  // Ngăn chặn CSRF attacks
    //   path: "/auth/refresh-token", // Chỉ gửi cookie tới route này
    // });
    //   async function fetchWithToken(url, options = {}) {
    //     const response = await fetch(url, options);

    //     if (response.status === 401) {
    //         // Access Token hết hạn → gọi API làm mới token
    //         await fetch('/auth/refresh-token', { method: 'POST', credentials: 'include' });

    //         // Gửi lại request gốc với Access Token mới
    //         return fetch(url, options);
    //     }

    //     return response;
    // }
    res.header("auth-token", token).send(token);
  }
});

router.post("/auth/refresh-token", (req, res) => {
  const refreshToken = req.cookies.refreshToken; // Lấy token từ cookie

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN!,
    (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: "Invalid refresh token" });
      }

      const newAccessToken = jwt.sign(
        { id: decoded.id },
        process.env.SECRET_TOKEN!,
        { expiresIn: "1h" }
      );

      res.json({ accessToken: newAccessToken });
    }
  );
});

export { router as loginRoutes };
