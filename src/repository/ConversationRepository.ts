import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Conversation, createConversationModel } from "../models/Conversation";
import { dynamoDBClient } from "../config/aws-config";
import { paginateScan } from "../utils/pagination";

const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Conversation";

// Tạo cuộc trò chuyện mới
export const createConversation = async (
  participants: string[],
  groupName?: string
): Promise<string> => {
  const conversationId = uuidv4();
  const conversation: Conversation = createConversationModel(
    participants,
    groupName,
    conversationId
  );

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: conversation,
  });

  await docClient.send(command);
  return conversationId;
};

// Lấy thông tin cuộc trò chuyện
export const getConversation = async (
  conversationId: string
): Promise<Conversation | null> => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
  });

  const result = await docClient.send(command);
  return (result.Item as Conversation) || null;
};

// Cập nhật người tham gia cuộc trò chuyện
export const addUsersToConversation = async (
  conversationId: string,
  newUserIds: string[]
): Promise<Conversation> => {
  const now = new Date().toISOString();

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
    UpdateExpression: "set participants = :participants, updateAt = :updateAt",
    ExpressionAttributeValues: {
      ":participants": newUserIds,
      ":updateAt": now,
    },
    ConditionExpression: "attribute_exists(id)", // Chỉ kiểm tra cuộc trò chuyện tồn tại
    ReturnValues: "UPDATED_NEW",
  });

  const result = await docClient.send(command);
  return result.Attributes as Conversation;
};

// Tìm các nhóm chung giữa hai người dùng
export const findCommonGroups = async (
  userId: string,
  targetUserId: string,
  page: number = 1,
  limit: number = 10
) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression:
      "contains(participants, :userId) AND contains(participants, :targetUserId)",
    ExpressionAttributeValues: {
      ":userId": userId,
      ":targetUserId": targetUserId,
    },
  };
  return paginateScan<Conversation>(docClient, params, page, limit);
};

export const getConversationsByUserId = async (
  userId: string
): Promise<Conversation[]> => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "contains(participants, :userId)",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });

  const result = await docClient.send(command);
  return (result.Items as Conversation[]) || [];
};
