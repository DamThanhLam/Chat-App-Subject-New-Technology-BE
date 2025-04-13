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

// export const createFriend = async (senderId: string, receiverId: string, message?: string) => {
//   const now = new Date().toISOString();
//   const friend: Friend = {
//     id: uuidv4(),
//     senderId,
//     receiverId,
//     status: FriendStatus.PENDING,
//     message,
//     createdAt: now,
//     updatedAt: now,
//   };

//   const params: DocumentClient.PutItemInput = {
//     TableName: TABLE_NAME,
//     Item: friend
//   };

//   await dynamoDb.put(params).promise();
//   return friend;
// };

export const createFriend = async (senderId: string, receiverId: string, message?: string) => {
  const now = new Date().toISOString();
  const id = uuidv4();

  // 1. Chiều A -> B
  const friend: Friend = {
    id,
    senderId,
    receiverId,
    status: FriendStatus.PENDING,
    message,
    createdAt: now,
    updatedAt: now,
  };

  // 2. Chiều B -> A (có thể dùng status riêng nếu cần)
  const reverseFriend: Friend = {
    id: uuidv4(),
    senderId: receiverId,
    receiverId: senderId,
    status: FriendStatus.PENDING,
    createdAt: now,
    updatedAt: now,
  };

  // Lưu cả hai bản ghi
  const put1 = dynamoDb.put({ TableName: TABLE_NAME, Item: friend }).promise();
  const put2 = dynamoDb.put({ TableName: TABLE_NAME, Item: reverseFriend }).promise();

  await Promise.all([put1, put2]);

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

// export const updateFriendStatus = async (id: string, status: FriendStatus) => {
//   const params: DocumentClient.UpdateItemInput = {
//     TableName: TABLE_NAME,
//     Key: { id },
//     UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
//     ExpressionAttributeNames: {
//       '#status': 'status',
//     },
//     ExpressionAttributeValues: {
//       ':status': status,
//       ':updatedAt': new Date().toISOString(),
//     },
//     ReturnValues: 'ALL_NEW',
//   };

//   const result = await dynamoDb.update(params).promise();
//   const updatedFriend = result.Attributes as Friend;

//   // 👇 Nếu chấp nhận lời mời thì thêm chiều ngược lại
//   if (status === FriendStatus.ACCEPTED) {
//     await addFriendToAcceptedList(updatedFriend.receiverId, updatedFriend.senderId);
//   }

//   return updatedFriend;
// };

// export const getAcceptedFriendsByUserId = async (userId: string) => {
//   const params: DocumentClient.QueryInput = {
//     TableName: TABLE_NAME,
//     IndexName: "receiverId-index",
//     KeyConditionExpression: 'receiverId = :uid',
//     FilterExpression: '#status = :accepted',
//     ExpressionAttributeValues: {
//       ':uid': userId,
//       ':accepted': FriendStatus.ACCEPTED,
//     },
//     ExpressionAttributeNames: {
//       '#status': 'status',
//     },
//   };

//   const result = await dynamoDb.query(params).promise();
//   return result.Items;
// };

export const updateFriendStatus = async (id: string, status: FriendStatus) => {
  // Update bản gốc theo ID
  const now = new Date().toISOString();

  const originalUpdate = dynamoDb.update({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': now,
    },
    ReturnValues: 'ALL_NEW',
  }).promise();

  // Lấy bản ghi gốc để tìm chiều ngược
  const original = await dynamoDb.get({ TableName: TABLE_NAME, Key: { id } }).promise();
  const friend = original.Item as Friend;

  // Tìm chiều ngược: B -> A
  const reverseQuery = await dynamoDb.query({
    TableName: TABLE_NAME,
    IndexName: 'senderId-index',
    KeyConditionExpression: 'senderId = :sid',
    FilterExpression: 'receiverId = :rid',
    ExpressionAttributeValues: {
      ':sid': friend.receiverId,
      ':rid': friend.senderId
    }
  }).promise();

  const reverseItem = reverseQuery.Items?.[0];
  let reverseUpdate;

  if (reverseItem) {
    reverseUpdate = dynamoDb.update({
      TableName: TABLE_NAME,
      Key: { id: reverseItem.id },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': now,
      }
    }).promise();
  }

  await Promise.all([originalUpdate, reverseUpdate]);

  return (await originalUpdate).Attributes as Friend;
};


export const getAcceptedFriendsByUserId = async (userId: string) => {
  const expressionNames = { '#status': 'status' };

  // 1. Truy vấn bạn bè mà user là receiver
  const receiverParams: DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    IndexName: "receiverId-index",
    KeyConditionExpression: 'receiverId = :uid',
    FilterExpression: '#status = :accepted',
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: {
      ':uid': userId,
      ':accepted': FriendStatus.ACCEPTED,
    },
  };

  // 2. Truy vấn bạn bè mà user là sender
  const senderParams: DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    IndexName: "senderId-index", // 👉 bạn cần tạo thêm GSI này
    KeyConditionExpression: 'senderId = :uid',
    FilterExpression: '#status = :accepted',
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: {
      ':uid': userId,
      ':accepted': FriendStatus.ACCEPTED,
    },
  };

  const [receiverResult, senderResult] = await Promise.all([
    dynamoDb.query(receiverParams).promise(),
    dynamoDb.query(senderParams).promise()
  ]);

  return [...(receiverResult.Items || []), ...(senderResult.Items || [])];
};


export const addFriendToAcceptedList = async (userId: string, friendId: string) => {
  // Kiểm tra xem đã có mối quan hệ bạn bè này chưa
  const existingFriendship = await dynamoDb
    .scan({
      TableName: TABLE_NAME,
      FilterExpression: '(senderId = :userId AND receiverId = :friendId) OR (senderId = :friendId AND receiverId = :userId)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':friendId': friendId
      }
    })
    .promise();

  if (existingFriendship.Items && existingFriendship.Items.length > 0) {
    // Nếu đã có, không cần thêm lại
    return;
  }

  // Nếu chưa có, tạo một mối quan hệ bạn bè mới
  const now = new Date().toISOString();
  const friend: Friend = {
    id: uuidv4(),
    senderId: userId,
    receiverId: friendId,
    status: FriendStatus.ACCEPTED,
    createdAt: now,
    updatedAt: now,
  };

  const params: DocumentClient.PutItemInput = {
    TableName: TABLE_NAME,
    Item: friend
  };

  await dynamoDb.put(params).promise();
};

// export const isAlreadyFriends = async (senderId: string, receiverId: string) => {
//   // Kiểm tra mối quan hệ bạn bè giữa sender và receiver
//   const params: DocumentClient.ScanInput = {
//     TableName: TABLE_NAME,
//     FilterExpression: '(senderId = :senderId AND receiverId = :receiverId) OR (senderId = :receiverId AND receiverId = :senderId)',
//     ExpressionAttributeValues: {
//       ':senderId': senderId,
//       ':receiverId': receiverId,
//     }
//   };

//   const result = await dynamoDb.scan(params).promise();
//   return result.Items && result.Items.length > 0;  // Nếu có mối quan hệ bạn bè, trả về true
// };

export const isAlreadyFriends = async (senderId: string, receiverId: string) => {
  const params: DocumentClient.ScanInput = {
    TableName: TABLE_NAME,
    FilterExpression: 
      '((senderId = :senderId AND receiverId = :receiverId) OR (senderId = :receiverId AND receiverId = :senderId)) AND #status IN (:pending, :accepted)',
    ExpressionAttributeValues: {
      ':senderId': senderId,
      ':receiverId': receiverId,
      ':pending': FriendStatus.PENDING,
      ':accepted': FriendStatus.ACCEPTED,
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    }
  };

  const result = await dynamoDb.scan(params).promise();
  return result.Items && result.Items.length > 0;
};


export const declineFriendRequestById = async (id: string) => {
  const original = await dynamoDb.get({
    TableName: TABLE_NAME,
    Key: { id },
  }).promise();

  const friend = original.Item as Friend;
  if (!friend) return null;  // Trả về null nếu không tìm thấy friend

  // Xóa bản gốc
  await dynamoDb.delete({
    TableName: TABLE_NAME,
    Key: { id },
  }).promise();

  // Xóa bản đảo (receiver gửi ngược lại sender)
  const reverseQuery = await dynamoDb.query({
    TableName: TABLE_NAME,
    IndexName: 'senderId-index',
    KeyConditionExpression: 'senderId = :sid',
    FilterExpression: 'receiverId = :rid',
    ExpressionAttributeValues: {
      ':sid': friend.receiverId,
      ':rid': friend.senderId,
    },
  }).promise();

  const reverseItem = reverseQuery.Items?.[0];

  if (reverseItem) {
    await dynamoDb.delete({
      TableName: TABLE_NAME,
      Key: { id: reverseItem.id },
    }).promise();
  }

  // Trả về friend đã bị hủy
  return friend;
};
