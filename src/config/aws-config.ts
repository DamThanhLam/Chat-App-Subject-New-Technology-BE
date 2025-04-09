import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();
console.log(process.env.AWS_ACCESS_KEY_ID)
// Đảm bảo các biến env không bị undefined
const awsConfig: DynamoDBClientConfig & S3ClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1', // Giá trị mặc định nếu không có
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
};
export const dynamoDBClient = new DynamoDBClient(awsConfig);
export const s3Client = new S3Client(awsConfig);
