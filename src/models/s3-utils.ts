import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandInput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/aws-config';

type UploadParams = {
  Bucket: string;
  Key: string;
  Body: Buffer;
  ContentType?: string;
};

type GetUrlParams = {
  Bucket: string;
  Key: string;
  Expires?: number;
};

export class S3Utils {
  static async uploadFile(params: UploadParams) {
    try {
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw error;
    }
  }

  static async getFileUrl(params: GetUrlParams, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand(params);
      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error('S3 Get URL Error:', error);
      throw error;
    }
  }

  static async deleteFile(params: DeleteObjectCommandInput) {
    try {
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
    } catch (error) {
      console.error('S3 Delete Error:', error);
      throw error;
    }
  }
}