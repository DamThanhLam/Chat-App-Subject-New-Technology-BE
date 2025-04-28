// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { Friend, FriendStatus } from '../models/Friend';
// import { v4 as uuidv4 } from 'uuid';
// import { User } from "../models/user";
// import {
//   DynamoDBDocumentClient,
//   QueryCommand,
//   GetCommand,
//   UpdateCommand,
//   QueryCommandInput,
//   ScanCommand,
// } from "@aws-sdk/lib-dynamodb";

// const client = new DynamoDBClient({});
// const docClient = DynamoDBDocumentClient.from(client);

// const FRIEND_TABLE = "Friend";
// const CONVERSATION_TABLE = "Conversation";
// const USER_TABLE = "User";

// // Kiểm tra xem hai người đã là bạn chưa
// export const isAlreadyFriend = async (senderId: string, receiverId: string) => {
//   const command = new QueryCommand({
//     TableName: FRIEND_TABLE,
//     IndexName: "senderId-receiverId-index", // Đảm bảo bạn đã tạo GSI này
//     KeyConditionExpression: "senderId = :s AND receiverId = :r",
//     ExpressionAttributeValues: {
//       ":s": senderId,
//       ":r": receiverId,
//     },
//   });

//   const response = await docClient.send(command);
//   return response.Items?.some(item => item.status === "accepted");
// };

// // Lấy conversation
// export const getConversation = async (conversationId: string) => {
//   const command = new GetCommand({
//     TableName: CONVERSATION_TABLE,
//     Key: { id: conversationId },
//   });

//   const response = await docClient.send(command);
//   return response.Item;
// };

// // Cập nhật requestJoin trong conversation
// export const addRequestJoin = async (conversationId: string, userId: string) => {
//   const command = new UpdateCommand({
//     TableName: CONVERSATION_TABLE,
//     Key: { id: conversationId },
//     UpdateExpression: "ADD requestJoin :userId",
//     ExpressionAttributeValues: {
//       ":userId": { SS: [userId] }, // Set of strings
//     },
//   });

//   return await docClient.send(command);
// };

// // Lấy danh sách người dùng theo email
// export const getUsersByEmail = async (email: string) => {
//     const params = new ScanCommand({
//           TableName: USER_TABLE,
//           FilterExpression: "email = :email", // so sánh tuyệt đối
//           ExpressionAttributeValues: {
//             ":email": email
//           }
//         });
    
//         try {
//           const result = await docClient.send(params);
//           console.log("Scan result:", result);
//           return result.Items?.map(user => ({
//             ...user,
//             createdAt: new Date(user.createdAt),
//             updatedAt: new Date(user.updatedAt)
//           })) as User[] || [];
//         } catch (error) {
//           console.error("Error querying DynamoDB:", error);
//           throw new Error("Error querying DynamoDB");
//         }
//   };