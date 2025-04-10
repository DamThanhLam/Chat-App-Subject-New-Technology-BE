import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDBClient } from "../config/aws-config";

const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "UserNickname";

export const saveNickname = async (
  userId: string,
  targetUserId: string,
  nickname: string
) => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      targetUserId,
      nickname,
      createAt: new Date().toISOString(),
      updateAt: new Date().toISOString(),
    },
  });

  await docClient.send(command);
};

export const updateNickname = async (
  userId: string,
  targetUserId: string,
  nickname: string
) => {
  const command = new UpdateCommand({
    TableName: "UserNickname",
    Key: { userId, targetUserId },
    UpdateExpression: "set nickname = :nickname, updateAt = :updateAt",
    ExpressionAttributeValues: {
      ":nickname": nickname,
      ":updateAt": new Date().toISOString(),
    },
    ConditionExpression: "attribute_exists(userId)", // Đảm bảo bản ghi đã tồn tại
    ReturnValues: "UPDATED_NEW",
  });

  await docClient.send(command);
};

// Lấy tên ghi nhớ
export const getNickname = async (userId: string, targetUserId: string) => {
  const command = new GetCommand({
    TableName: "UserNickname",
    Key: { userId, targetUserId },
  });

  const result = await docClient.send(command);
  return result.Item ? result.Item.nickname : null;
};
