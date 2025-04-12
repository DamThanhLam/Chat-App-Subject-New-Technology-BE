import { FriendStatus } from '../models/Friend';
import { createFriend, getAcceptedFriendsByUserId, getFriendsByUserId, getPendingFriendRequestsByUserId, updateFriendStatus } from '../repository/FriendRepository';

export const getFriendList = async (userId: string) => {
  const friends = await getFriendsByUserId(userId);
  return friends || [];
};

export const getPendingFriendRequests = async (userId: string) => {
  const requests = await getPendingFriendRequestsByUserId(userId);
  return requests || [];
};

export const addFriend = async (senderId: string, receiverId: string, message?: string) => {
  return await createFriend(senderId, receiverId, message);
};


export const acceptFriendRequest = async (id: string) => {
  return await updateFriendStatus(id, FriendStatus.ACCEPTED);
};

export const getFriendListAccept = async (userId: string) => {
  const friends = await getAcceptedFriendsByUserId(userId);
  return friends || [];
};