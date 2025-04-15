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
    console.log(`User found: ${JSON.stringify(result.Item)}`);

    return {
      ...result.Item,
      createdAt: new Date(result.Item.createdAt),
      updatedAt: new Date(result.Item.updatedAt),
    } as User;
  }

  async updateUser(
    id: string,
    updatedData: Partial<User>
  ): Promise<User | null> {
    (updatedData as any).updatedAt = new Date().toISOString();

    const updateExpression = `set ${Object.keys(updatedData)
      .map((key, index) => `#${key} = :value${index}`)
      .join(", ")}`;

    const expressionAttributeNames = Object.keys(updatedData).reduce(
      (acc, key, index) => {
        acc[`#${key}`] = key;
        return acc;
      },
      {} as Record<string, string>
    );

    const expressionAttributeValues = Object.keys(updatedData).reduce(
      (acc, key, index) => {
        acc[`:value${index}`] = updatedData[key as keyof User]; // Đảm bảo giá trị đúng kiểu
        return acc;
      },
      {} as Record<string, any>
    );

    const params = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    const result = await docClient.send(params);
    if (!result.Attributes) return null;

    return {
      ...result.Attributes,
      createdAt: new Date(result.Attributes.createdAt),
      updatedAt: new Date(result.Attributes.updatedAt),
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
