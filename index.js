// generate-keys.js
const { generateKeyPairSync } = require("crypto");
const fs = require("fs");

// Tạo cặp khóa RSA
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048, // Độ dài khóa
  publicKeyEncoding: {
    type: "spki", // Định dạng chuẩn cho public key
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8", // Định dạng chuẩn cho private key
    format: "pem",
  },
});

// Lưu khóa vào file
fs.writeFileSync("private-key.pem", privateKey);
fs.writeFileSync("public-key.pem", publicKey);

console.log("Private Key:\n", privateKey);
console.log("Public Key:\n", publicKey);
