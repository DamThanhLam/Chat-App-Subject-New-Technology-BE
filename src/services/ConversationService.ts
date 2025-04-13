// src/services/ConversationService.ts
import * as conversationRepository from "../repository/ConversationRepository";
import { Conversation } from "../models/Conversation";

// Tạo nhóm chat từ đoạn chat đôi
export const createGroupFromChat = async (
  currentUserId: string,
  friendUserId: string,
  additionalUserIds: string[] = [],
  groupName: string = "New Group"
) => {
  try {
    if (!currentUserId || !friendUserId) {
      throw new Error("Thiếu ID người dùng bắt buộc");
    }

    const participants = [currentUserId, friendUserId, ...additionalUserIds];
    const uniqueParticipants = [...new Set(participants)];

    if (!uniqueParticipants.every((id) => typeof id === "string")) {
      throw new Error("Tất cả ID người dùng phải là chuỗi");
    }

    const conversationId = await conversationRepository.createConversation(
      uniqueParticipants,
      groupName
    );

    return { conversationId, message: "Tạo nhóm thành công" };
  } catch (error: any) {
    throw new Error(`Không thể tạo nhóm: ${error.message}`);
  }
};

// Thêm người dùng vào nhóm chat
export const addUsersToGroup = async (
  conversationId: string,
  currentUserId: string,
  newUserIds: string[]
) => {
  try {
    if (
      !conversationId ||
      !currentUserId ||
      !newUserIds ||
      !Array.isArray(newUserIds)
    ) {
      throw new Error("Thiếu hoặc dữ liệu không hợp lệ");
    }

    if (!newUserIds.every((id) => typeof id === "string")) {
      throw new Error("Tất cả ID người dùng mới phải là chuỗi");
    }

    const conversation: Conversation | null =
      await conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    if (!conversation.participants.includes(currentUserId)) {
      throw new Error("Bạn không phải là thành viên của nhóm này");
    }

    const alreadyInGroup = newUserIds.filter((id) =>
      conversation.participants.includes(id)
    );
    if (alreadyInGroup.length > 0) {
      throw new Error(
        `Người dùng đã có trong nhóm: ${alreadyInGroup.join(", ")}`
      );
    }

    const updatedParticipants = [
      ...new Set([...conversation.participants, ...newUserIds]),
    ];
    await conversationRepository.addUsersToConversation(
      conversationId,
      updatedParticipants
    );

    return { message: "Thêm người dùng vào nhóm thành công" };
  } catch (error: any) {
    throw new Error(`Không thể thêm người dùng vào nhóm: ${error.message}`);
  }
};

// Tìm các nhóm chung giữa hai người dùng
export const findCommonGroups = async (
  userId: string,
  targetUserId: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    if (!userId || !targetUserId) {
      throw new Error("Thiếu ID người dùng bắt buộc");
    }

    if (typeof userId !== "string" || typeof targetUserId !== "string") {
      throw new Error("ID người dùng phải là chuỗi");
    }

    const result = await conversationRepository.findCommonGroups(
      userId,
      targetUserId,
      page,
      limit
    );

    return {
      groups: result.items,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
      limit: result.limit,
    };
  } catch (error: any) {
    throw new Error(`Không thể tìm nhóm chung: ${error.message}`);
  }
};
