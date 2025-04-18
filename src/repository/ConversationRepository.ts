import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  UpdateCommandInput,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Conversation, createConversationModel } from "../models/Conversation";
import { dynamoDBClient } from "../config/aws-config";
import { paginateScan } from "../utils/pagination";

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
  const participants = uniqueParticipants.map(id => ({
    id,
    method: "normal"
  }));

  const conversation: Conversation = {
    id: uuidv4(),
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
      chat: true 
    },
    requestJoin: [],
    avatarUrl: ""
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: conversation
  }));

  return conversation;
};

// Hàm lấy danh sách nhóm theo userId (sử dụng participantsIds)
export const getConversationsByUserId = async (userId: string): Promise<Conversation[]> => {
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


export const saveConversation = async (conversation: Conversation): Promise<void> => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: conversation,
  });

  await docClient.send(command);
};

// Hàm lấy các nhóm mà người dùng đã gia nhập
export const getConversationsByUser = async (userId: string): Promise<Conversation[]> => {
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

export const joinedGroup = async(conversationId: string, userId: string)=>{
  const command =new GetCommand({
    TableName: TABLE_NAME,
    Key:{id:conversationId}
  })
  const response = docClient.send(command)
  const conversation = (await response).Item as Conversation
  if(conversation.participants.filter(item=>item.id === userId)) return true
  return false
}

export const getPermission = async(conversationId: string)=>{
  const command =new GetCommand({
    TableName: TABLE_NAME,
    Key:{id:conversationId}
  })
  const response = docClient.send(command)
  const conversation = (await response).Item as Conversation
  if(!conversation) return null;
  return conversation.permission;
}
// Tạo cuộc trò chuyện mới
// export const createConversation = async (
//   participants: string[],
//   groupName?: string
// ): Promise<string> => {
//   const conversationId = uuidv4();
//   const conversation: Conversation = createConversationModel(
//     participants,
//     groupName,
//     conversationId
//   );

//   const command = new PutCommand({
//     TableName: TABLE_NAME,
//     Item: conversation,
//   });

//   await docClient.send(command);
//   return conversationId;
// };

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
  // 1. Tạo các expression từ object conversation
  //    - Bỏ qua id vì là key
  //    - Đổi createAt thành N (number) nếu cần, hoặc giữ string
  const {
    id,
    createAt,
    ...fieldsToUpdate
  } = conversation;

  // 2. Xây dựng UpdateExpression và ExpressionAttributeValues
  const setExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};

  Object.entries(fieldsToUpdate).forEach(([key, value]) => {
    // Chỉ cập nhật những trường không undefined
    if (value !== undefined) {
      const placeholder = `:${key}`;
      setExpressions.push(`#${key} = ${placeholder}`);
      expressionValues[placeholder] = value;
    }
  });

  // Luôn cập nhật updateAt
  setExpressions.push(`#updateAt = :updateAt`);
  expressionValues[":updateAt"] = new Date().toISOString();

  const UpdateExpression = `SET ${setExpressions.join(", ")}`;

  // 3. Định nghĩa ExpressionAttributeNames để tránh reserved keywords
  const expressionNames = Object.keys(fieldsToUpdate).reduce(
    (acc, key) => ({ ...acc, [`#${key}`]: key }),
    {} as Record<string, string>
  );
  expressionNames["#updateAt"] = "updateAt";

  const params: UpdateCommandInput = {
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: "ALL_NEW", // Trả về item sau khi cập nhật
  };

  // 4. Gửi lệnh UpdateCommand
  const command = new UpdateCommand(params);
  const response = await client.send(command);

  // 5. Trả về item mới
  return response.Attributes as Conversation;
};
export const getConversationByLink= async(link:string)=>{
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    ExpressionAttributeValues:{
      ":link":link
    },
    FilterExpression:":link = link"
  })
  const item = (await docClient.send(command)).Items?.at(0)
  return item as Conversation
}
export const getAllConversationId = async()=>{
  const command = new ScanCommand({TableName:TABLE_NAME})
  const listConversationId = (await docClient.send(command)).Items?.map(item=>{return item.id})
  return listConversationId
}
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