export interface InviteLink {
  id: string | null;
  groupId: string;
  link: string;
  createdAt: Date;
  expiresAt: Date;
}
