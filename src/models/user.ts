export interface User {
  id: String | null;
  name: string;
  email: String;
  phoneNumber: String;
  status: "online" | "offline";
  createdAt: Date;
  updatedAt: Date;
  urlAVT: string;
}
