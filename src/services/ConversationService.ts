// src/services/ConversationService.ts
import * as conversationRepository from "../repository/ConversationRepository";
import { Conversation } from "../models/Conversation";
import { UserRepository } from "../repository/UserRepository";
const userRepository = new UserRepository()
// Tạo nhóm chat từ đoạn chat đôi
// export const createGroupFromChat = async (
//   currentUserId: string,
//   friendUserId: string,
//   additionalUserIds: string[] = [],
//   groupName: string = "New Group"
// ) => {
//   try {
//     if (!currentUserId || !friendUserId) {
//       throw new Error("Thiếu ID người dùng bắt buộc");
//     }

//     const participants = [currentUserId, friendUserId, ...additionalUserIds];
//     const uniqueParticipants = [...new Set(participants)];

//     if (!uniqueParticipants.every((id) => typeof id === "string")) {
//       throw new Error("Tất cả ID người dùng phải là chuỗi");
//     }

//     const conversationId = await conversationRepository.createConversation(
//       uniqueParticipants,
//       groupName
//     );

//     return { conversationId, message: "Tạo nhóm thành công" };
//   } catch (error: any) {
//     throw new Error(`Không thể tạo nhóm: ${error.message}`);
//   }
// };
export const joinedGroup = async (conversationId: string, userId: string): Promise<boolean> => {
  return conversationRepository.joinedGroup(conversationId, userId)
}
export const checkPermissionAutoJoin = async (conversationId: string): Promise<boolean> => {
  const permission = await conversationRepository.getPermission(conversationId)
  if (permission) {
    return permission.acceptJoin
  }
  return false
}

// Thêm người dùng vào nhóm chat
export const autoJoinToGroup = async (
  conversationId: string,
  newUserId: string,
  method: string
) => {
  try {
    if (
      !conversationId ||
      !newUserId ||
      !method
    ) {
      throw new Error("Thiếu hoặc dữ liệu không hợp lệ");
    }

    const conversation: Conversation | null =
      await conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    const user = await userRepository.findById(newUserId)

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    const listConversation = user.listConversation ? [...user.listConversation, conversation.id] : [conversation.id]

    conversation.participants = [...conversation.participants, { id: newUserId, method: method }]

    await userRepository.updateUser(user.id, { listConversation: listConversation })

    await conversationRepository.update(
      conversation
    );

    return { message: "Thêm người dùng vào nhóm thành công" };
  } catch (error: any) {
    throw new Error(`Không thể thêm người dùng vào nhóm: ${error.message}`);
  }
};
// Thêm người dùng vào nhóm chat
export const moveQueueRequestJoinConversation = async (
  conversationId: string,
  newUserId: string,
  method: string
) => {
  try {
    if (
      !conversationId ||
      !newUserId ||
      !method
    ) {
      throw new Error("Thiếu hoặc dữ liệu không hợp lệ");
    }

    const conversation: Conversation | null =
      await conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }


    const user = await userRepository.findById(newUserId)

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    conversation.requestJoin = [...conversation.requestJoin, { id: newUserId, method: method }]

    const listInvite = user.listInvite ? [...user.listInvite, { id: newUserId, method: method }] : [{ id: newUserId, method: method }]
    await userRepository.updateUser(user.id, { listInvite: listInvite })

    await conversationRepository.update(
      conversation
    );

    return { message: "đợi chấp nhận vào nhóm thành công" };
  } catch (error: any) {
    throw new Error(`Không thể thêm người dùng vào nhóm: ${error.message}`);
  }
};

export const getConversationByLink = async (link: string) => {
  return await conversationRepository.getConversationByLink(link)
}
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
export const leaveRoom = async (userId: string, roomId: string) => {
  const user = await userRepository.findById(userId)
  const listConversation = user?.listConversation?.filter(item => item != roomId)
  await userRepository.updateUser(userId, { listConversation: listConversation })

}
// export const getConversationById = async (
//   conversationId: string,
//   currentUserId: string
// ): Promise<Conversation> => {
//   try {
//     if (!conversationId || typeof conversationId !== "string") {
//       throw new Error("conversationId không hợp lệ");
//     }

//     if (!currentUserId || typeof currentUserId !== "string") {
//       throw new Error("currentUserId không hợp lệ");
//     }

//     const conversation = await conversationRepository.getConversation(
//       conversationId
//     );
//     if (!conversation) {
//       throw new Error("Không tìm thấy cuộc trò chuyện");
//     }

//     if (!conversation.participants.includes(currentUserId)) {
//       throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
//     }

//     return conversation;
//   } catch (error: any) {
//     throw new Error(
//       `Không thể lấy thông tin cuộc trò chuyện: ${error.message}`
//     );
//   }
// };
