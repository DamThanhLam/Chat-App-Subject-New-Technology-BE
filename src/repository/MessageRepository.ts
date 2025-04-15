import { Message } from "../models/Message";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDBClient } from "../config/aws-config";
import { AttributeValue, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Message";
import { paginateScan } from "../utils/pagination";
import { randomUUID } from "crypto";
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
  async getMessagesByFriendId(
    userId: string,
    friendId: string,
    exclusiveStartKey?: string
  ): Promise<Message[]> {
    try {
      const input: any = {
        TableName: TABLE_NAME,
        ExpressionAttributeValues: {
          ":userId": { S: userId },
          ":friendId": { S: friendId },
        },
        FilterExpression:
          "((senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)) AND (attribute_not_exists(deletedBy) OR not contains(deletedBy, :userId))",
        ScanIndexForward: false,
      };

      if (exclusiveStartKey) {
        input.ExclusiveStartKey = {
          id: { S: exclusiveStartKey }, // Chính xác tên cột khóa chính trong bảng
        };
      }
      let response;
      try {
        const command = new ScanCommand(input);
        console.log("Command đã tạo:", command);
        response = await docClient.send(command);
      } catch (dynamoError: any) {
        console.error("Lỗi từ DynamoDB - Chi tiết:", {
          error: dynamoError,
          name: dynamoError.name,
          message: dynamoError.message,
          stack: dynamoError.stack,
        });
        throw new Error(`Lỗi DynamoDB: ${dynamoError.message}`);
      }

      // Log dữ liệu thô từ DynamoDB
      console.log("response.Items:", response.Items);

      // Giải mã và lọc các tin nhắn không hợp lệ
      const messages = (response.Items ?? [])
        .map((item) => {
          try {
            const message = unmarshall(item) as Message;
            // Kiểm tra xem message có createdAt không và định dạng có hợp lệ không
            if (!message.createdAt) {
              console.warn("Tin nhắn không có createdAt:", message);
              return null; // Bỏ qua tin nhắn không hợp lệ
            }

            // Kiểm tra định dạng ngày hợp lệ
            const date = new Date(message.createdAt);
            if (isNaN(date.getTime())) {
              console.warn("Tin nhắn có createdAt không hợp lệ:", message);
              return null; // Bỏ qua tin nhắn không hợp lệ
            }

            return message;
          } catch (error: any) {
            console.error("Lỗi khi giải mã tin nhắn:", item, error.message);
            return null; // Bỏ qua tin nhắn lỗi
          }
        })
        .filter((message): message is Message => message !== null); // Loại bỏ các tin nhắn null

      // Log dữ liệu sau khi giải mã và lọc
      console.log("messages (filtered):", messages);

      // Nếu mảng rỗng, trả về ngay
      if (messages.length === 0) {
        console.log("Không có tin nhắn hợp lệ để sắp xếp");
        return [];
      }

      // Sắp xếp theo createdAt giảm dần (mới nhất trước)
      const sortedMessages = messages
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        // Lấy 20 bản ghi đầu tiên sau khi sort

      // Log dữ liệu sau khi sắp xếp
      console.log("messages (sorted):", sortedMessages);

      return sortedMessages;
    } catch (error: any) {
      throw new Error(`Không thể lấy tin nhắn: ${error.message}`);
    }
  }
  async getLatestMessage(userId: string, friendId: string) {
    const input: any = {
      TableName: "Message",
      ExpressionAttributeValues: {
        ":userId": { S: userId },
        ":friendId": { S: friendId },
      },
      FilterExpression:
        "((senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)) AND not contains(deletedBy, :userId)",
    };
    const command = new ScanCommand(input);
    const response = await docClient.send(command);
    console.log(response.Items);
    // 👇 Giải mã và sắp xếp theo createdAt giảm dần (mới nhất trước)
    const messages = (response.Items ?? [])
      .map((item) => unmarshall(item) as Message)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    return messages[0] ?? null;
  }
  async getById(messageId: string): Promise<Message | null> {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: messageId },
    });
    const result = await docClient.send(command);
    const item = result.Item;
    if (!item) {
      return null; // hoặc throw new Error("Not found")
    }
    return item as Message;
  }
  async update(message: Message) {
    const command = new PutCommand({ TableName: TABLE_NAME, Item: message });
    await docClient.send(command);
  }

  async markMessagesAsDeleted(userId: string, friendId: string): Promise<void> {
    try {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          "(senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)",
        ExpressionAttributeValues: {
          ":userId": { S: userId },
          ":friendId": { S: friendId },
        },
      });

      const scanResult = await docClient.send(scanCommand);
      const messages = scanResult.Items || [];
      console.log("messages (raw):", messages);

      const unmarshalledMessages = messages.map((item) => unmarshall(item));
      console.log("messages (unmarshalled):", unmarshalledMessages);

      for (const message of unmarshalledMessages) {
        const updateCommand = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            id: message.id,
          },
          UpdateExpression:
            "SET deletedBy = list_append(if_not_exists(deletedBy, :empty_list), :userId)",
          ExpressionAttributeValues: {
            ":userId": [userId],
            ":empty_list": [],
            ":userIdCheck": userId,
          },
          ConditionExpression: "NOT contains(deletedBy, :userIdCheck)",
        });

        try {
          await docClient.send(updateCommand);
        } catch (error: any) {
          if (error.name === "ConditionalCheckFailedException") {
            console.log(
              `UserId ${userId} already exists in deletedBy for message ${message.id}`
            );
            continue;
          }
          throw error;
        }
      }
    } catch (error: any) {
      throw new Error(
        `Không thể đánh dấu tin nhắn là đã xóa: ${error.message}`
      );
    }
  }

  async searchMessagesByUserAndFriend(
    userId: string,
    friendId: string,
    keyword: string
  ): Promise<{ messages: Message[]; lastEvaluatedKey?: string }> {
    try {
      const normalizedKeyword = keyword.toLowerCase();

      // Lấy tất cả tin nhắn giữa userId và friendId
      const params: any = {
        TableName: TABLE_NAME,
        ExpressionAttributeValues: {
          ":userId": { S: userId },
          ":friendId": { S: friendId },
        },
        FilterExpression:
          "((senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)) AND (attribute_not_exists(deletedBy) OR not contains(deletedBy, :userId))",
        ScanIndexForward: false,
      };

      const command = new ScanCommand(params);
      const response = await docClient.send(command);

      // Log dữ liệu thô từ DynamoDB
      console.log("Raw response.Items:", response.Items);

      if (!response.Items || !Array.isArray(response.Items)) {
        console.warn(
          "No messages found for userId:",
          userId,
          "and friendId:",
          friendId
        );
        return { messages: [], lastEvaluatedKey: undefined };
      }

      // Chuẩn hóa tin nhắn và lọc theo từ khóa
      const messages = response.Items.map((item) => unmarshall(item) as Message)
        .filter((message) => {
          // Kiểm tra message có tồn tại và là string không
          if (!message || typeof message.message !== "string") {
            console.warn("Invalid message or message content:", message);
            return false;
          }

          // Chuẩn hóa nội dung tin nhắn (chuyển thành chữ thường)
          const normalizedMessage = message.message.toLowerCase();
          console.log("Normalized message:", normalizedMessage);

          return normalizedMessage.includes(normalizedKeyword);
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      console.log("Messages found:", messages);

      return {
        messages,
        lastEvaluatedKey: response.LastEvaluatedKey
          ? JSON.stringify(response.LastEvaluatedKey)
          : undefined,
      };
    } catch (error: any) {
      console.error("Error in searchMessagesByUserAndFriend:", error);
      throw new Error(`Failed to search messages: ${error.message}`);
    }
  }

  // Thêm phương thức mới để lấy danh sách tin nhắn media
  async getMediaMessages(
    userId: string,
    friendId: string,
    exclusiveStartKey?: string
  ): Promise<{ messages: Message[]; lastEvaluatedKey?: string }> {
    try {
      const input: any = {
        TableName: TABLE_NAME,
        ExpressionAttributeNames: {
          "#status": "status", // Thay thế từ khóa dự trữ 'status'
        },
        ExpressionAttributeValues: {
          ":userId": { S: userId },
          ":friendId": { S: friendId },
          ":contentTypeFile": { S: "file" },
          ":contentTypeText": { S: "text" },
          ":deletedStatus": { S: "deleted" },
          ":recalledStatus": { S: "recalled" },
        },
        FilterExpression:
          "((senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)) " +
          "AND (attribute_not_exists(deletedBy) OR not contains(deletedBy, :userId)) " +
          "AND (contentType = :contentTypeFile OR contentType = :contentTypeText) " +
          "AND (#status <> :deletedStatus AND #status <> :recalledStatus)",
        ScanIndexForward: false,
      };

      if (exclusiveStartKey) {
        input.ExclusiveStartKey = {
          id: { S: exclusiveStartKey },
        };
      }

      const command = new ScanCommand(input);
      const response = await docClient.send(command);

      console.log("Raw media response.Items:", response.Items);

      if (!response.Items || !Array.isArray(response.Items)) {
        console.warn(
          "No media messages found for userId:",
          userId,
          "and friendId:",
          friendId
        );
        return { messages: [], lastEvaluatedKey: undefined };
      }

      const messages = response.Items.map(
        (item) => unmarshall(item) as Message
      );

      return {
        messages,
        lastEvaluatedKey: response.LastEvaluatedKey
          ? JSON.stringify(response.LastEvaluatedKey)
          : undefined,
      };
    } catch (error: any) {
      console.error("Error in getMediaMessages:", error);
      throw new Error(`Failed to get media messages: ${error.message}`);
    }
  }
}
