export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  status: "online" | "offline";
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string;
  listInvite?:{
    method: string,
    id: string
  }[],
  listConversation?: string[]
}
