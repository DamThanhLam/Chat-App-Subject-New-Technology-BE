import { FriendStatus } from '../models/Friend';
import { addFriendToAcceptedList, createFriend, declineFriendRequestById, getAcceptedFriendsByUserId, getFriendsByUserId, getPendingFriendRequestsByUserId, isAlreadyFriends, updateFriendStatus } from '../repository/FriendRepository';

export const getFriendList = async (userId: string) => {
  const friends = await getFriendsByUserId(userId);
  return friends || [];
};

export const getPendingFriendRequests = async (userId: string) => {
  const requests = await getPendingFriendRequestsByUserId(userId);
  return requests || [];
};

export const addFriend = async (senderId: string, receiverId: string, message?: string) => {
  const isFriends = await isAlreadyFriends(senderId, receiverId);
  
  if (isFriends) {
    throw new Error("Đã là bạn bè, không thể gửi lời mời kết bạn");
  }
  return await createFriend(senderId, receiverId, message);
};


// export const acceptFriendRequest = async (id: string) => {
//   return await updateFriendStatus(id, FriendStatus.ACCEPTED);
// };

export const acceptFriendRequest = async (id: string) => {
  const updatedRequest = await updateFriendStatus(id, FriendStatus.ACCEPTED);
  
  // Cập nhật danh sách bạn bè cho cả người gửi và người nhận
  await addFriendToAcceptedList(updatedRequest.senderId, updatedRequest.receiverId);
  await addFriendToAcceptedList(updatedRequest.receiverId, updatedRequest.senderId);
  
  return updatedRequest;
};

export const cancelFriendRequest = async (id: string) => {
  return await declineFriendRequestById(id);
};

export const getFriendListAccept = async (userId: string) => {
  const friends = await getAcceptedFriendsByUserId(userId);
  return friends || [];
};