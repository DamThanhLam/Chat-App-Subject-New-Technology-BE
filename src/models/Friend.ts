export enum FriendStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    DECLINED = "declined",
    CANCELLED = "cancelled",
    BLOCKED = "blocked",
  }
  
  export interface Friend {
    id: string;
    senderId: string;
    receiverId: string;
    senderAVT?: string;
    message?: string;
    status: FriendStatus;
    createdAt: string;
    updatedAt: string;
  }
  