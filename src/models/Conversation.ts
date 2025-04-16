// src/models/conversationModel.ts
export interface Conversation {
  id: string;
  participants: {
    method: string,
    id: string
  }[],
  groupName?: string;
  lastMessage: any;
  createAt: string;
  updateAt: string;
  parentMessage: any;
  requestJoin: {
    method: string,
    id: string
  }[],
  linkJoin: string,
  permission: {
    chat: boolean,
    acceptJoin: boolean
  },
  listBlock: string[],
  leaderId: string,
  deputyId: string
}

// Hàm tạo Conversation mới
export const createConversationModel = (
  participants: {method: string,id: string}[],
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
    deputyId: "",
    leaderId: "",
    linkJoin: "",
    listBlock: [],
    permission: { acceptJoin: true, chat: true },
    requestJoin: []
  };
};
