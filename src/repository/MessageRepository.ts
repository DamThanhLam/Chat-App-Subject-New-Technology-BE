import { randomUUID } from "crypto";
import { Message } from "../models/Message";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBClient } from "../config/aws-config";

const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Message";
import { paginateScan } from "../utils/pagination";
export class MessageRepository {
  async post(message: Message) {
    message.id = randomUUID();

    const params = new PutCommand({
      TableName: TABLE_NAME,
      Item: message,
    });

    await docClient.send(params);
    return message;
  }
  async searchMessages(
    conversationId: string,
    keyword: string,
    page: number = 1,
    limit: number = 10
  ) {
    const params = {
      TableName: "Message",
      FilterExpression:
        "conversationId = :conversationId AND contains(message, :keyword)",
      ExpressionAttributeValues: {
        ":conversationId": conversationId,
        ":keyword": keyword,
      },
    };

    return paginateScan<Message>(docClient, params, page, limit);
  }
}
