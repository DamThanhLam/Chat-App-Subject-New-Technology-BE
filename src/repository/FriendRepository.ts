import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Friend, FriendStatus } from '../models/Friend';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new DocumentClient();
const TABLE_NAME = 'Friends';

export const getFriendsByUserId = async (userId: string) => {
  const params: DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    IndexName: "receiverId-index",
    KeyConditionExpression: 'receiverId = :uid',
    ExpressionAttributeValues: {
      ':uid': userId
    }
  };

  const result = await dynamoDb.query(params).promise();
  return result.Items;
};

export const createFriend = async (senderId: string, receiverId: string, message?: string) => {
  const now = new Date().toISOString();
  const friend: Friend = {
    id: uuidv4(),
    senderId,
    receiverId,
    status: FriendStatus.PENDING,
    message,
    createdAt: now,
    updatedAt: now,
  };

  const params: DocumentClient.PutItemInput = {
    TableName: TABLE_NAME,
    Item: friend
  };

  await dynamoDb.put(params).promise();
  return friend;
};

export const getPendingFriendRequestsByUserId = async (userId: string) => {
  const params: DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    IndexName: "receiverId-index", // GSI đã tạo
    KeyConditionExpression: 'receiverId = :uid',
    FilterExpression: '#status = :pending',
    ExpressionAttributeValues: {
      ':uid': userId,
      ':pending': FriendStatus.PENDING,
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
  };

  const result = await dynamoDb.query(params).promise();
  return result.Items;
};

export const updateFriendStatus = async (id: string, status: FriendStatus) => {
  const params: DocumentClient.UpdateItemInput = {
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamoDb.update(params).promise();
  return result.Attributes as Friend;
};

export const getAcceptedFriendsByUserId = async (userId: string) => {
  const params: DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    IndexName: "receiverId-index",
    KeyConditionExpression: 'receiverId = :uid',
    FilterExpression: '#status = :accepted',
    ExpressionAttributeValues: {
      ':uid': userId,
      ':accepted': FriendStatus.ACCEPTED,
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
  };

  const result = await dynamoDb.query(params).promise();
  return result.Items;
};


