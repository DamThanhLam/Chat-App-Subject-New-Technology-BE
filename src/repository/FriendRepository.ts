import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Friend, FriendStatus } from '../models/Friend';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new DocumentClient();
const TABLE_NAME = 'Friends';

//Tìm bạn theo UserId
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




//Kết bạn theo email
export const createFriend = async (senderId: string, receiverId: string, message?: string) => {
  if (senderId === receiverId) {
    throw new Error("Không thể gửi lời mời kết bạn tới chính mình.");
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  // Chỉ tạo bản ghi A -> B
  const friend: Friend = {
    id,
    senderId,
    receiverId,
    status: FriendStatus.PENDING,
    message,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.put({ TableName: TABLE_NAME, Item: friend }).promise();

  return friend;
};

//Hiển thị danh sách lời mời kết bạn
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

//Thay đổi trạng thái bạn bè
export const updateFriendStatus = async (id: string, status: FriendStatus) => {
  const now = new Date().toISOString();

  // Cập nhật bản ghi gốc (A -> B)
  const updated = await dynamoDb.update({
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

  return updated.Attributes as Friend;
};

export const getAcceptedFriendsByUserId = async (userId: string) => {
  const now = new Date().toISOString();
  const status = FriendStatus.ACCEPTED;

  const expressionNames = { '#status': 'status' };

  const queryAcceptedFriends = (indexName: string, keyName: 'senderId' | 'receiverId') => ({
    TableName: TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: `${keyName} = :uid`,
    FilterExpression: '#status = :accepted',
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: {
      ':uid': userId,
      ':accepted': status,
    },
  });

  const [received, sent] = await Promise.all([
    dynamoDb.query(queryAcceptedFriends("receiverId-index", "receiverId")).promise(),
    dynamoDb.query(queryAcceptedFriends("senderId-index", "senderId")).promise(),
  ]);

  const all = [...(received.Items || []), ...(sent.Items || [])];

  // Chuẩn hóa: luôn trả về friendId là người còn lại
  const normalized = all.map((item) => ({
    ...item,
    friendId: item.senderId === userId ? item.receiverId : item.senderId
  }));

  return normalized;
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
