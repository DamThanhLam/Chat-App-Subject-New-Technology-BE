// src/services/conversationService.ts
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
      throw new Error("Missing required user IDs");
    }

    const participants = [currentUserId, friendUserId, ...additionalUserIds];
    const uniqueParticipants = [...new Set(participants)];

    if (!uniqueParticipants.every((id) => typeof id === "string")) {
      throw new Error("All user IDs must be strings");
    }

    const conversationId = await conversationRepository.createConversation(
      uniqueParticipants,
      "group",
      groupName
    );

    return { conversationId, message: "Group created successfully" };
  } catch (error: any) {
    throw new Error(`Failed to create group: ${error.message}`);
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
      throw new Error("Missing or invalid required fields");
    }

    if (!newUserIds.every((id) => typeof id === "string")) {
      throw new Error("All new user IDs must be strings");
    }

    const conversation: Conversation | null =
      await conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.messageType !== "group") {
      throw new Error("This conversation is not a group chat");
    }

    if (!conversation.participants.includes(currentUserId)) {
      throw new Error("You are not a member of this group");
    }

    const alreadyInGroup = newUserIds.filter((id) =>
      conversation.participants.includes(id)
    );
    if (alreadyInGroup.length > 0) {
      throw new Error(`Users already in group: ${alreadyInGroup.join(", ")}`);
    }

    const updatedParticipants = [
      ...new Set([...conversation.participants, ...newUserIds]),
    ];
    await conversationRepository.addUsersToConversation(
      conversationId,
      updatedParticipants
    );

    return { message: "Users added to group successfully" };
  } catch (error: any) {
    throw new Error(`Failed to add users to group: ${error.message}`);
  }
};

export const findCommonGroups = async (
  userId: string,
  targetUserId: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    if (!userId || !targetUserId) {
      throw new Error("Missing required user IDs");
    }

    if (typeof userId !== "string" || typeof targetUserId !== "string") {
      throw new Error("User IDs must be strings");
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
    throw new Error(`Failed to find common groups: ${error.message}`);
  }
};
