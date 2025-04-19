// src/models/conversationModel.ts
export interface Conversation {
  id: string;
  participants: {
    method: string;
    id: string;
  }[];
  participantsIds: string[]; // Trường mới để optimize query
  groupName?: string;
  lastMessage: any;
  createAt: string;
  updateAt: string;
  parentMessage: any;
  requestJoin: {
    method: string;
    id: string;
  }[];
  linkJoin: string;
  permission: {
    chat: boolean;
    acceptJoin: boolean;
  };
  listBlock: string[];
  leaderId: string;
  deputyId: string;
  avatarUrl?: string; // Thêm nếu cần
  pendingParticipants?: {
    method: string;
    id: string;
    invitedBy: string;
  }[];
}

// Hàm tạo Conversation mới (đã bổ sung participantsIds)
export const createConversationModel = (
  participants: {method: string, id: string}[],
  groupName?: string,
  conversationId?: string,
  options?: {
    leaderId?: string;
    avatarUrl?: string;
  }
): Conversation => {
  const now = new Date().toISOString();
  
  return {
    id: conversationId || "",
    participants,
    participantsIds: participants.map(p => p.id), // Tạo mảng IDs
    groupName: groupName || "",
    lastMessage: null,
    createAt: now,
    updateAt: now,
    parentMessage: null,
    deputyId: "",
    leaderId: options?.leaderId || participants[0]?.id || "", // Mặc định là người đầu tiên
    linkJoin: "",
    listBlock: [],
    permission: { 
      acceptJoin: true, 
      chat: true 
    },
    requestJoin: [],
    avatarUrl: options?.avatarUrl || "",
    pendingParticipants: [],
  };
};