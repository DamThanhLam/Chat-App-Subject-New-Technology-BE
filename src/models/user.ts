export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  status: "online" | "offline";
  createdAt: Date;
  updatedAt: Date;
  urlAVT: string;
  listInvite?:{
    method: string,
    id: string
  }[],
  listConversation?: string[]
}
