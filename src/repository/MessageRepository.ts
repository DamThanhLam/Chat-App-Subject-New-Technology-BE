import { randomUUID } from "crypto";
import { Message } from "../models/Message";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBClient } from "../config/aws-config";
import { AttributeValue, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Message";

export class MessageRepository {
    async post(message: Message) {
        message.id = randomUUID();

        const params = new PutCommand({
            TableName: TABLE_NAME,
            Item: message
        });

        await docClient.send(params);
        return message;
    }
    async getMessagesByFriendId(userId: string, friendId: string, exclusiveStartKey: string) {
        const input: any = {
            TableName: "Message",
            ExpressionAttributeValues: {
                ":userId": { S: userId },
                ":friendId": { S: friendId }
            },
            FilterExpression: "(senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)",
            ScanIndexForward: false // Lấy tin nhắn mới nhất trước
        };
        if (exclusiveStartKey) {
            input.ExclusiveStartKey = {
                id: { S: exclusiveStartKey } // chính xác tên cột khóa chính trong bảng
            };
        }
        const command = new ScanCommand(input);
        const response = await docClient.send(command);
        // 👇 Giải mã và sắp xếp theo createdAt giảm dần (mới nhất trước)
        const messages = (response.Items ?? [])
            .map((item) => unmarshall(item) as Message)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20); // lấy 20 bản ghi đầu tiên sau khi sort
        return messages
    }
    async getLatestMessage(userId: string, friendId: string) {
        const input: any = {
            TableName: "Message",
            ExpressionAttributeValues: {
                ":userId": { S: userId },
                ":friendId": { S: friendId }
            },
            FilterExpression: "(senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)",
        };
        const command = new ScanCommand(input);
        const response = await docClient.send(command);
        console.log(response.Items)
        // 👇 Giải mã và sắp xếp theo createdAt giảm dần (mới nhất trước)
        const messages = (response.Items ?? [])
            .map((item) => unmarshall(item) as Message)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return messages[0] ?? null;
    }
}
