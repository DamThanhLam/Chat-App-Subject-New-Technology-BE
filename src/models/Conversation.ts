// src/models/conversationModel.ts
export interface Conversation {
  id: string;
  participants: string[];
  groupName?: string;
  lastMessage: any;
  createAt: string;
  updateAt: string;
  parentMessage: any;
  messageType: "group" | "private";
}

// Hàm tạo Conversation mới
export const createConversationModel = (
  participants: string[],
  messageType: "group" | "private",
  groupName?: string,
  conversationId?: string
): Conversation => {
  const now = new Date().toISOString();
  return {
    id: conversationId || "",
    participants,
    groupName,
    lastMessage: null,
    createAt: now,
    updateAt: now,
    parentMessage: null,
    messageType,
  };
};
