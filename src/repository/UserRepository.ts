import { randomUUID } from "crypto";
import { User } from "../models/user";
import { hashPassword } from "../encryption/scrypto/scrypto";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDBClient } from "../config/aws-config";

const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "User";

export class UserRepository {
  async createUser(user: User): Promise<User> {
    user.id = randomUUID();
    (user as any).createdAt = new Date().toISOString();
    (user as any).updatedAt = new Date().toISOString();

    const params = new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
    });

    await docClient.send(params);
    return user;
  }
  async findUserId(id: string) {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: id }
    })
    const user = (await docClient.send(command)).Item as User
    return user.name
  }

  async getUsers(): Promise<User[]> {
    const params = new ScanCommand({ TableName: TABLE_NAME });
    const result = await docClient.send(params);

    // Chuyển đổi ngày từ string về Date (nếu cần)
    return result.Items?.map((user) => ({
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    })) as User[];
  }

  async findById(id: string): Promise<User | null> {
    const params = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    });

    const result = await docClient.send(params);
    if (!result.Item) return null;

    // Chuyển kiểu Date chỉ khi cần dùng, không lưu ngược lại vào DB
    const user = result.Item;

    return {
      ...user,
      createdAt: typeof user.createdAt === "string" ? new Date(user.createdAt) : user.createdAt,
      updatedAt: typeof user.updatedAt === "string" ? new Date(user.updatedAt) : user.updatedAt,
    } as User;
  }
  async updateUser(
    id: string,
    updatedData: Partial<User>
  ): Promise<User | null> {
    // 1. Cập nhật updatedAt
    const now = new Date();
    (updatedData as any).updatedAt = now.toISOString();

    // 2. Lọc bỏ những field không muốn update
    delete (updatedData as any).createdAt;
    delete (updatedData as any).id;  // <-- bỏ qua id

    // 3. Lấy danh sách keys sau khi đã lọc
    const keys = Object.keys(updatedData);
    if (keys.length === 0) {
      // Không có gì để update
      return this.findById(id);
    }

    // 4. Build UpdateExpression
    const updateExpression = `SET ${keys
      .map((key, i) => `#${key} = :v${i}`)
      .join(', ')}`;

    const ExpressionAttributeNames = keys.reduce((acc, key) => {
      acc['#' + key] = key;
      return acc;
    }, {} as Record<string, string>);

    const ExpressionAttributeValues = keys.reduce((acc, key, i) => {
      let val = updatedData[key as keyof User];
      if (val instanceof Date) {
        val = val.toISOString();
      }
      acc[`:v${i}`] = val;
      return acc;
    }, {} as Record<string, any>);

    // 5. Gửi lệnh lên DynamoDB
    const params = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id:id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(params);
    if (!result.Attributes) return null;

    // 6. Chuyển ISO string thành Date khi trả về
    return {
      ...result.Attributes,
      createdAt:
        typeof result.Attributes.createdAt === 'string'
          ? new Date(result.Attributes.createdAt)
          : result.Attributes.createdAt,
      updatedAt:
        typeof result.Attributes.updatedAt === 'string'
          ? new Date(result.Attributes.updatedAt)
          : result.Attributes.updatedAt,
    } as User;
  }


  async addUserToGroup(userId: string, groupId: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) {
      console.log(`User ${userId} added to group ${groupId}`);
      // TODO: thực hiện logic thêm groupId vào danh sách group của user
    } else {
      console.error(`User ${userId} not found`);
    }
  }

  // Tìm kiếm người dùng theo email
  async findUsersByEmail(email: string): Promise<User[]> {
    const params = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "email = :email", // so sánh tuyệt đối
      ExpressionAttributeValues: {
        ":email": email
      }
    });

    try {
      const result = await docClient.send(params);
      console.log("Scan result:", result);
      return result.Items?.map(user => ({
        ...user,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt)
      })) as User[] || [];
    } catch (error) {
      console.error("Error querying DynamoDB:", error);
      throw new Error("Error querying DynamoDB");
    }
  }


}
