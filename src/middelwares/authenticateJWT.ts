import { expressjwt } from "express-jwt";
import dotenv from 'dotenv';
import JwksRsa from "jwks-rsa";
import jwksClient from "jwks-rsa";
import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import { Socket } from "socket.io";
dotenv.config();
const {
  AWS_REGION,
  USER_POOL_ID,
  CLIENT_ID,
  PORT
} = process.env;

export const authenticateJWT = expressjwt({
  secret: JwksRsa.expressJwtSecret({
    jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  }),
  audience: CLIENT_ID,
  issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`,
  algorithms: ["RS256"],
});

// Tạo client kết nối đến Cognito JWKS
const client = jwksClient({
  jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});
// Lấy public key từ JWKS để xác thực token
function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  client.getSigningKey(header.kid as string, (err:any, key:any) => {
    if (err) return callback(err, undefined);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Middleware xác thực
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("No token provided"));
  }

  jwt.verify(
    token,
    getKey,
    {
      audience: CLIENT_ID,
      issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      console.log(decoded)
      if (err) {
        console.error("JWT verification failed:", err);
        return next(new Error("Authentication error"));
      }

      // Lưu user vào socket để truy cập sau này
      (socket as any).user = decoded;
      next();
    }
  );
}

