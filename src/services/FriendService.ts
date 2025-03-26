import { FriendRepository } from "../repository/FriendRepository";
import { v4 as uuidv4 } from "uuid";

export class FriendService {
  private friendRepository = new FriendRepository();

  async sendFriendRequest(senderId: string, receiverId: string, message?: string) {
    const friendRequest = {
      id: uuidv4(),
      senderId,
      receiverId,
      senderAVT: "", 
      message: message || "",
      status: "pending",
      createAt: new Date().toISOString(),
      updateAt: new Date().toISOString(),
    };
    return await this.friendRepository.createFriendRequest(friendRequest);
  }

  async getFriendRequest(id: string) {
    return await this.friendRepository.getFriendRequest(id);
  }

  async getFriendRequests(userId: string) {
    return await this.friendRepository.getFriendRequests(userId);
  }
  

  async acceptFriendRequest(id: string) {
    return await this.friendRepository.updateFriendStatus(id, "accepted");
  }

  async declineFriendRequest(id: string) {
    return await this.friendRepository.updateFriendStatus(id, "declined");
  }

  async cancelFriendRequest(id: string) {
    return await this.friendRepository.updateFriendStatus(id, "cancelled");
  }

  async deleteFriendRequest(id: string) {
    return await this.friendRepository.deleteFriendRequest(id);
  }
}
