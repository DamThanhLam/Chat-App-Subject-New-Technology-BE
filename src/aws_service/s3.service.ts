import dotenv from "dotenv";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/aws-config";

dotenv.config();

interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

const S3Service = {
  post: async (file: UploadedFile): Promise<string> => {
    const randomString = (length: number): string =>
      Math.random().toString(36).substring(2, length + 2);

    const filePath = `${randomString(4)}-${Date.now()}-${file.originalname}`;

    try {
      const command = new PutObjectCommand({
        Bucket: "lam-dev-iuh",
        Key: "app-chat/"+filePath,
        Body: file.buffer,
      });

      await s3Client.send(command);

      const fileUrl = `${process.env.CLOUDFRONT_URL}${filePath}`;
      return fileUrl;
    } catch (err) {
      console.error("Error uploading file to AWS S3:", err);
      throw new Error("Upload file to AWS S3 failed");
    }
  },
};

export default S3Service;
