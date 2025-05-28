import { FriendStatus } from '../models/Friend';
import { addFriendToAcceptedList, cancelFriendRequestA, createFriend, declineFriendRequestById, deleteFriendByPair, getAcceptedFriendsByUserId, getFriendsByUserId, getPendingFriendRequestsByUserId, isAlreadyFriends, isPendingFriendRequest, updateFriendStatus } from '../repository/FriendRepository';

export const getFriendList = async (userId: string) => {
  const friends = await getAcceptedFriendsByUserId(userId);
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

export const cancelFriendRequestListFriend = async (senderId: string, receiverId: string) => {
  return await cancelFriendRequestA(senderId, receiverId);
};

export const checkPendingRequest = async (senderId: string, receiverId: string): Promise<boolean> => {
  return await isPendingFriendRequest(senderId, receiverId);
};

export const getFriendListAccept = async (userId: string) => {
  const friends = await getAcceptedFriendsByUserId(userId);
  return friends || [];
};

//Delete Friend 28-5-2025
export const deleteFriend = async (userId: string, friendId: string): Promise<void> => {
  // Bạn có thể kiểm tra thêm nếu cần: đảm bảo userId không trùng friendId, v.v.
  if (userId === friendId) {
    throw new Error("Cannot delete friend with yourself.");
  }
  // Gọi repository để xóa dựa vào cặp senderId và receiverId.
  await deleteFriendByPair(userId, friendId);
  
};