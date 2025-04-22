import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  UpdateCommandInput,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Conversation } from "../models/Conversation";
import { dynamoDBClient } from "../config/aws-config";
import { paginateScan } from "../utils/pagination";
import { MessageRepository } from "./MessageRepository";

const client = dynamoDBClient;
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Conversation";

// Hàm tạo nhóm mới
export const createConversation = async (
  leaderId: string,
  participantIds: string[],
  groupName: string = "Nhóm mới"
): Promise<Conversation> => {
  const uniqueParticipants = Array.from(new Set([leaderId, ...participantIds]));

  const participants = uniqueParticipants.map((id) => ({
    id,
    method: leaderId,
  }));
  console.log(uniqueParticipants);
  const totalUniqueMembers = new Set([leaderId, ...participantIds]);

  if (totalUniqueMembers.size < 3) {
    throw new Error("Nhóm phải có ít nhất 3 thành viên (bao gồm trưởng nhóm)");
  }

  if (!groupName || groupName.trim() === "") {
    throw new Error("Tên nhóm không được để trống");
  }
  const conversation: Conversation = {
    id: uuidv4().toString(),
    participants,
    participantsIds: uniqueParticipants,
    groupName,
    leaderId,
    deputyId: "",
    createAt: new Date().toISOString(),
    updateAt: new Date().toISOString(),
    lastMessage: null,
    parentMessage: null,
    linkJoin: "",
    listBlock: [],
    permission: {
      acceptJoin: true,
      chat: true,
    },
    requestJoin: [],
    avatarUrl: "",
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: conversation,
    })
  );

  return conversation;
};

// Hàm lấy danh sách nhóm theo userId (sử dụng participantsIds)
export const getConversationsByUserId = async (
  userId: string
): Promise<Conversation[]> => {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "contains(participantsIds, :userId)",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const result = await docClient.send(command);
    return result.Items as Conversation[];
  } catch (error) {
    console.error("Lỗi khi lấy danh sách nhóm:", error);
    throw new Error("Không thể lấy danh sách nhóm.");
  }
};

export const saveConversation = async (
  conversation: Conversation
): Promise<void> => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: conversation,
  });

  await docClient.send(command);
};

// Hàm lấy các nhóm mà người dùng đã gia nhập
export const getConversationsByUser = async (
  userId: string
): Promise<Conversation[]> => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "contains(participants, :userId)",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });

  const { Items } = await docClient.send(command);
  return Items as Conversation[];
};

export const joinedGroup = async (conversationId: string, userId: string) => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
  });
  const response = docClient.send(command);
  const conversation = (await response).Item as Conversation;
  if (conversation.participants.filter((item) => item.id === userId))
    return true;
  return false;
};

export const getPermission = async (conversationId: string) => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
  });
  const response = docClient.send(command);
  const conversation = (await response).Item as Conversation;
  if (!conversation) return null;
  return conversation.permission;
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

/**
 * Cập nhật Conversation vào DynamoDB
 */
export const update = async (conversation: Conversation) => {
  const { id, createAt, ...fieldsToUpdate } = conversation;

  const setExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  // Xử lý các trường cần cập nhật
  Object.entries(fieldsToUpdate).forEach(([key, value]) => {
    if (value !== undefined) {
      const placeholder = `:${key}`;
      const namePlaceholder = `#${key}`;
      setExpressions.push(`${namePlaceholder} = ${placeholder}`);
      expressionValues[placeholder] = value;
      expressionNames[namePlaceholder] = key;
    }
  });

  // Thêm updateAt vào danh sách cập nhật
  const updateAtPlaceholder = "#updateAt";
  setExpressions.push(`${updateAtPlaceholder} = :updateAt`);
  expressionValues[":updateAt"] = new Date().toISOString();
  expressionNames[updateAtPlaceholder] = "updateAt";

  if (setExpressions.length === 0) {
    throw new Error("No fields to update");
  }

  const UpdateExpression = `SET ${setExpressions.join(", ")}`;

  console.log("UpdateExpression:", UpdateExpression);
  console.log("ExpressionAttributeNames:", expressionNames);
  console.log("ExpressionAttributeValues:", expressionValues);

  const params: UpdateCommandInput = {
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: "ALL_NEW",
  };

  try {
    const command = new UpdateCommand(params);
    const response = await docClient.send(command);
    console.log("Updated conversation:", response.Attributes);
    return response.Attributes as Conversation;
  } catch (error) {
    console.error("Error updating conversation:", error);
    throw error;
  }
};

export const updateGroupName = async (
  conversation: Conversation
): Promise<Conversation> => {
  // Đảm bảo tất cả các trường cần thiết đều có trong conversation
  const updatedConversation = {
    ...conversation,
    updateAt: new Date().toISOString(), // Luôn cập nhật updateAt
  };

  console.log("Conversation before saving:", updatedConversation);

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: updatedConversation,
  });

  try {
    await docClient.send(command);
    console.log("Conversation updated successfully:", updatedConversation);
    return updatedConversation;
  } catch (error) {
    console.error("Error updating conversation:", error);
    throw error;
  }
};
export const getConversationByLink = async (link: string) => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    ExpressionAttributeValues: {
      ":link": link,
    },
    FilterExpression: ":link = link",
  });
  const item = (await docClient.send(command)).Items?.at(0);
  return item as Conversation;
};
export const getAllConversationId = async () => {
  const command = new ScanCommand({ TableName: TABLE_NAME });
  const listConversationId = (await docClient.send(command)).Items?.map(
    (item) => {
      return item.id;
    }
  );
  return listConversationId;
};

export const addUsersToConversation = async (
  conversationId: string,
  newUserIds: string[]
): Promise<Conversation> => {
  const now = new Date().toISOString();

  // Lấy thông tin cuộc trò chuyện hiện tại
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error("Cuộc trò chuyện không tồn tại");
  }

  // Lấy danh sách participants hiện tại
  const currentParticipants = conversation.participants || [];
  const currentParticipantIds = conversation.participantsIds || [];

  // Loại bỏ các userId đã có trong nhóm và chuẩn bị danh sách mới
  const participantsToAdd = newUserIds
    .filter((userId) => !currentParticipantIds.includes(userId))
    .map((userId) => ({
      id: userId,
      method: "normal", // Có thể thay đổi method nếu cần
    }));

  const updatedParticipants = [...currentParticipants, ...participantsToAdd];
  const updatedParticipantIds = [
    ...currentParticipantIds,
    ...newUserIds.filter((userId) => !currentParticipantIds.includes(userId)),
  ];

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
    UpdateExpression:
      "set participants = :participants, participantsIds = :participantsIds, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":participants": updatedParticipants,
      ":participantsIds": updatedParticipantIds,
      ":updatedAt": now,
    },
    ConditionExpression: "attribute_exists(id)", // Chỉ kiểm tra cuộc trò chuyện tồn tại
    ReturnValues: "ALL_NEW",
  });

  const result = await docClient.send(command);
  return result.Attributes as Conversation;
};

export const findCommonGroups = async (
  userId: string,
  targetUserId: string,
  page: number = 1,
  limit: number = 10
) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: `
      (participants[0].id = :userId OR participants[1].id = :userId OR participants[2].id = :userId) AND
      (participants[0].id = :targetUserId OR participants[1].id = :targetUserId OR participants[2].id = :targetUserId)
    `,
    ExpressionAttributeValues: {
      ":userId": userId,
      ":targetUserId": targetUserId,
    },
  };
  return paginateScan<Conversation>(docClient, params, page, limit);
};

// Xóa một người dùng khỏi nhóm chat
export const removeUserFromConversation = async (
  conversationId: string,
  userId: string,
  newLeaderId?: string
): Promise<Conversation> => {
  const now = new Date().toISOString();

  // Lấy thông tin cuộc trò chuyện hiện tại
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error("Cuộc trò chuyện không tồn tại");
  }

  // Lọc bỏ người dùng khỏi participants và participantsIds
  const updatedParticipants = (conversation.participants || []).filter(
    (participant) => participant.id !== userId
  );
  const updatedParticipantIds = (conversation.participantsIds || []).filter(
    (id) => id !== userId
  );

  const updateExpressionParts = [
    "set participants = :participants, participantsIds = :participantsIds, updatedAt = :updatedAt",
  ];
  const expressionValues: Record<string, any> = {
    ":participants": updatedParticipants,
    ":participantsIds": updatedParticipantIds,
    ":updatedAt": now,
  };

  // Nếu cần cập nhật leaderId (trường hợp người rời là trưởng nhóm)
  if (newLeaderId) {
    updateExpressionParts.push("leaderId = :newLeaderId");
    expressionValues[":newLeaderId"] = newLeaderId;
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
    UpdateExpression: updateExpressionParts.join(", "),
    ExpressionAttributeValues: expressionValues,
    ConditionExpression: "attribute_exists(id)",
    ReturnValues: "ALL_NEW",
  });

  const result = await docClient.send(command);
  return result.Attributes as Conversation;
};

// Xóa nhóm chat (khi không còn thành viên)
export const deleteConversation = async (
  conversationId: string
): Promise<void> => {
  try {
    const messageRepository = new MessageRepository();
    // Bước 1: Xóa tất cả tin nhắn liên quan đến conversationId
    await messageRepository.deleteMessagesByConversationId(conversationId);

    // Bước 2: Xóa nhóm chat
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id: conversationId },
      ConditionExpression: "attribute_exists(id)",
    });

    await docClient.send(command);
    console.log("Conversation deleted:", conversationId);
  } catch (error: any) {
    console.error("Error in deleteConversation:", error);
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }
};

export const updateConversation = async (
  conversationId: string,
  updates: Partial<Conversation>
): Promise<Conversation> => {
  const now = new Date().toISOString();

  const setExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  // Xử lý các trường cần cập nhật
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      const placeholder = `:${key}`;
      const namePlaceholder = `#${key}`;
      setExpressions.push(`${namePlaceholder} = ${placeholder}`);
      expressionValues[placeholder] = value;
      expressionNames[namePlaceholder] = key;
    }
  });

  // Luôn cập nhật trường updateAt
  setExpressions.push("#updateAt = :updateAt");
  expressionValues[":updateAt"] = now;
  expressionNames["#updateAt"] = "updateAt";

  if (setExpressions.length === 0) {
    throw new Error("No fields to update");
  }

  const UpdateExpression = `SET ${setExpressions.join(", ")}`;

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: conversationId },
    UpdateExpression,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ConditionExpression: "attribute_exists(id)",
    ReturnValues: "ALL_NEW",
  });

  try {
    const result = await docClient.send(command);
    return result.Attributes as Conversation;
  } catch (error: any) {
    console.error("Error updating conversation:", error);
    throw new Error(`Không thể cập nhật cuộc trò chuyện: ${error.message}`);
  }
};
