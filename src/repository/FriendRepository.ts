import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDb } from "../database";
import { Friend } from "../models/Friend";
import { dynamoDBClient } from "../config/aws-config";

const TABLE_NAME = "Friends";
const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);
export class FriendRepository {
  private db = dynamoDb;

  async createFriendRequest(data: any) {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: data,
    });
    await this.db.send(command);
    return data;
  }

  async getFriendRequest(id: string) {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    });
    const result = await this.db.send(command);
    return result.Item;
  }

  async getFriendRequests(userId: string) {
    try {
      const receiverQuery = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "receiverId-index",
        KeyConditionExpression: "receiverId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      });

      const senderQuery = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "senderId-index",
        KeyConditionExpression: "senderId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      });

      const [receiverResult, senderResult] = await Promise.all([
        this.db.send(receiverQuery),
        this.db.send(senderQuery),
      ]);

      return [...(receiverResult.Items || []), ...(senderResult.Items || [])];
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      throw error;
    }
  }

  async updateFriendStatus(id: string, status: string) {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: "SET #status = :status, updateAt = :updateAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":updateAt": new Date().toISOString(),
      },
      ReturnValues: "UPDATED_NEW",
    });
    const result = await this.db.send(command);
    return result.Attributes;
  }

  async deleteFriendRequest(id: string) {
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
    });
    await this.db.send(command);
  }

  async getFriends(userId: string): Promise<Friend[]> {
    const params = {
      TableName: "Friends",
      FilterExpression:
        "(senderId = :userId OR receiverId = :userId) AND #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
        ":status": "accepted",
      },
    };

    const command = new ScanCommand(params);
    const result = await docClient.send(command);
    return (result.Items as Friend[]) || [];
  }
}
