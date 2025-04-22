// src/services/ConversationService.ts
import * as conversationRepository from "../repository/ConversationRepository";
import { Conversation } from "../models/Conversation";
import { UserRepository } from "../repository/UserRepository";
import { log } from "node:console";
// Removed unused import
const userRepository = new UserRepository();

export const createGroupConversation = async (
  leaderId: string,
  participantIds: string[],
  groupName: string = "Nhóm mới"
): Promise<{ conversation: Conversation; message: string }> => {
  // Validate input
  if (!leaderId || !participantIds || !Array.isArray(participantIds)) {
    throw new Error("Thông tin đầu vào không hợp lệ");
  }

  const conversation = await conversationRepository.createConversation(
    leaderId,
    participantIds,
    groupName
  );
  participantIds.map(async (item) => {
    const user = await userRepository.findById(item);
    if (!user) return;
    if (!user.listConversation) {
      user.listConversation = [];
    }
    user.listConversation.push(conversation.id);
    userRepository.updateUser(user.id, user);
  });

  return {
    conversation,
    message: "Tạo nhóm thành công",
  };
};

export const getConversationsOfUser = async (
  userId: string
): Promise<Conversation[]> => {
  if (!userId) throw new Error("UserId là bắt buộc");
  return await conversationRepository.getConversationsByUserId(userId);
};

//Tạo nhóm chat từ đoạn chat đôi
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

export const joinedGroup = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  return conversationRepository.joinedGroup(conversationId, userId);
};
export const checkPermissionAutoJoin = async (
  conversationId: string
): Promise<boolean> => {
  const permission = await conversationRepository.getPermission(conversationId);
  if (permission) {
    return permission.acceptJoin;
  }
  return false;
};

// Thêm người dùng vào nhóm chat
export const autoJoinToGroup = async (
  conversationId: string,
  newUserId: string,
  method: string
) => {
  try {
    if (!conversationId || !newUserId || !method) {
      throw new Error("Thiếu hoặc dữ liệu không hợp lệ");
    }

    const conversation: Conversation | null =
      await conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    const user = await userRepository.findById(newUserId);

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    const listConversation = user.listConversation
      ? [...user.listConversation, conversation.id]
      : [conversation.id];

    conversation.participants = [
      ...conversation.participants,
      { id: newUserId, method: method },
    ];

    await userRepository.updateUser(user.id, {
      listConversation: listConversation,
    });

    await conversationRepository.update(conversation);

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
    if (!conversationId || !newUserId || !method) {
      throw new Error("Thiếu hoặc dữ liệu không hợp lệ");
    }

    const conversation: Conversation | null =
      await conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    const user = await userRepository.findById(newUserId);

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    conversation.requestJoin = [
      ...conversation.requestJoin,
      { id: newUserId, userInvite: method },
    ];

    const listInvite = user.listInvite
      ? [...user.listInvite, { id: newUserId, method: method }]
      : [{ id: newUserId, method: method }];
    await userRepository.updateUser(user.id, { listInvite: listInvite });

    await conversationRepository.update(conversation);

    return { message: "đợi chấp nhận vào nhóm thành công" };
  } catch (error: any) {
    throw new Error(`Không thể thêm người dùng vào nhóm: ${error.message}`);
  }
};

export const getConversationByLink = async (link: string) => {
  return await conversationRepository.getConversationByLink(link);
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
export const leaveRoom = async (userId: string, roomId: string) => {
  const user = await userRepository.findById(userId);
  const listConversation = user?.listConversation?.filter(
    (item) => item != roomId
  );
  await userRepository.updateUser(userId, {
    listConversation: listConversation,
  });
};
export const getConversationById = async (
  conversationId: string,
  currentUserId: string
): Promise<Conversation> => {
  try {
    if (!conversationId || typeof conversationId !== "string") {
      throw new Error("conversationId không hợp lệ");
    }

    if (!currentUserId || typeof currentUserId !== "string") {
      throw new Error("currentUserId không hợp lệ");
    }

    const conversation = await conversationRepository.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    if (
      !conversation.participants.some(
        (participant) => participant.id === currentUserId
      )
    ) {
      throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
    }

    return conversation;
  } catch (error: any) {
    throw new Error(
      `Không thể lấy thông tin cuộc trò chuyện: ${error.message}`
    );
  }
};
export const addUsersToGroup = async (
  conversationId: string,
  currentUserId: string,
  newUserIds: string[]
): Promise<Conversation> => {
  try {
    // Kiểm tra dữ liệu đầu vào
    if (!conversationId || typeof conversationId !== "string") {
      throw new Error("conversationId không hợp lệ");
    }
    if (!currentUserId || typeof currentUserId !== "string") {
      throw new Error("currentUserId không hợp lệ");
    }
    if (!Array.isArray(newUserIds) || newUserIds.length === 0) {
      throw new Error("newUserIds phải là mảng không rỗng");
    }
    if (!newUserIds.every((id) => typeof id === "string")) {
      throw new Error("Tất cả newUserIds phải là chuỗi");
    }

    // Lấy thông tin nhóm hiện tại
    const conversation = await conversationRepository.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    // Kiểm tra quyền của người dùng hiện tại
    if (!conversation.participants.some((p) => p.id === currentUserId)) {
      throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
    }
    if (conversation.leaderId !== currentUserId) {
      throw new Error("Chỉ trưởng nhóm mới có quyền thêm thành viên");
    }

    // Kiểm tra các thành viên mới
    const existingUsers = await Promise.all(
      newUserIds.map(async (userId) => {
        const user = await userRepository.findById(userId);
        if (!user) {
          throw new Error(`Không tìm thấy người dùng với ID: ${userId}`);
        }
        return user;
      })
    );

    // Cập nhật nhóm trong bảng Conversation
    const updatedConversation =
      await conversationRepository.addUsersToConversation(
        conversationId,
        newUserIds
      );

    // Cập nhật listConversation của các thành viên mới trong bảng User
    await Promise.all(
      existingUsers.map(async (user) => {
        const listConversation = user.listConversation
          ? [...user.listConversation, conversationId]
          : [conversationId];
        await userRepository.updateUser(user.id, {
          listConversation,
        });
      })
    );

    return updatedConversation;
  } catch (error: any) {
    throw new Error(`Không thể thêm thành viên vào nhóm: ${error.message}`);
  }
};

// Người dùng rời khỏi nhóm
export const leaveGroup = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    // Validate inputs
    if (!conversationId || typeof conversationId !== "string") {
      throw new Error("conversationId không hợp lệ");
    }
    if (!userId || typeof userId !== "string") {
      throw new Error("userId không hợp lệ");
    }

    // Lấy thông tin nhóm hiện tại
    const conversation = await conversationRepository.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    // Kiểm tra xem người dùng có trong nhóm không
    if (!conversation.participantsIds.includes(userId)) {
      throw new Error("Bạn không phải là thành viên của nhóm này");
    }

    // Xử lý trường hợp người rời là trưởng nhóm
    let updatedConversation: Conversation | null = null;
    if (conversation.leaderId === userId) {
      const remainingParticipants = conversation.participantsIds.filter(
        (p) => p !== userId
      );

      if (remainingParticipants.length === 0) {
        // Nếu không còn thành viên nào, xóa nhóm
        await conversationRepository.deleteConversation(conversationId);
        updatedConversation = null;
      } else {
        // Ưu tiên chuyển quyền trưởng nhóm cho nhóm phó (deputyId) nếu có
        let newLeaderId: string;
        if (
          conversation.deputyId &&
          remainingParticipants.includes(conversation.deputyId)
        ) {
          newLeaderId = conversation.deputyId; // Chuyển quyền cho nhóm phó
        } else {
          // Nếu không có nhóm phó, chuyển quyền cho thành viên đầu tiên
          newLeaderId = remainingParticipants[0];
        }

        // Xóa người dùng và cập nhật trưởng nhóm
        updatedConversation =
          await conversationRepository.removeUserFromConversation(
            conversationId,
            userId,
            newLeaderId
          );

        // Nếu nhóm phó được chọn làm trưởng nhóm, xóa deputyId
        if (newLeaderId === conversation.deputyId) {
          updatedConversation = await conversationRepository.updateConversation(
            conversationId,
            {
              deputyId: undefined,
            }
          );
        }
      }
    } else {
      // Trường hợp thông thường: chỉ xóa người dùng khỏi nhóm
      updatedConversation =
        await conversationRepository.removeUserFromConversation(
          conversationId,
          userId
        );
    }

    // Cập nhật listConversation của người dùng trong bảng User
    const user = await userRepository.findById(userId);
    if (user) {
      const updatedListConversation = (user.listConversation || []).filter(
        (convId) => convId !== conversationId
      );
      await userRepository.updateUser(userId, {
        listConversation: updatedListConversation,
      });
    }

    if (!updatedConversation) {
      return;
    }
  } catch (error: any) {
    throw new Error(`Không thể rời nhóm: ${error.message}`);
  }
};

// Xóa nhóm chat (chỉ trưởng nhóm mới có quyền)
export const deleteGroup = async (
  conversationId: string,
  currentUserId: string
): Promise<void> => {
  try {
    if (!conversationId || typeof conversationId !== "string") {
      throw new Error("conversationId không hợp lệ");
    }
    if (!currentUserId || typeof currentUserId !== "string") {
      throw new Error("currentUserId không hợp lệ");
    }

    // Lấy thông tin nhóm hiện tại
    const conversation = await conversationRepository.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    // Kiểm tra quyền của người dùng hiện tại
    if (!conversation.participants.some((p) => p.id === currentUserId)) {
      throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
    }
    if (conversation.leaderId !== currentUserId) {
      throw new Error("Chỉ trưởng nhóm mới có quyền xóa nhóm");
    }

    // Cập nhật listConversation của tất cả thành viên trong nhóm
    const participantIds = conversation.participantsIds || [];
    await Promise.all(
      participantIds.map(async (userId) => {
        const user = await userRepository.findById(userId);
        if (user) {
          const updatedListConversation = (user.listConversation || []).filter(
            (convId) => convId !== conversationId
          );
          await userRepository.updateUser(userId, {
            listConversation: updatedListConversation,
          });
          console.log("updatedListConversation", updatedListConversation);
        }
      })
    );

    // Xóa nhóm
    await conversationRepository.deleteConversation(conversationId);
  } catch (error: any) {
    throw new Error(`Không thể xóa nhóm: ${error.message}`);
  }
};

export const renameGroup = async (
  conversationId: string,
  newName: string
): Promise<void> => {
  try {
    const conversation = await conversationRepository.getConversation(
      conversationId
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversation.groupName = newName;

    await conversationRepository.updateGroupName(conversation);
  } catch (error: any) {
    console.error("Error updating group name:", error);
    throw error; // Hoặc xử lý lỗi tùy theo yêu cầu
  }
};

export const removeUserFromGroup = async (
  conversationId: string,
  currentUserId: string,
  userIdToRemove: string
): Promise<void> => {
  try {
    // Validate inputs
    if (!conversationId || typeof conversationId !== "string") {
      throw new Error("conversationId không hợp lệ");
    }
    if (!currentUserId || typeof currentUserId !== "string") {
      throw new Error("currentUserId không hợp lệ");
    }
    if (!userIdToRemove || typeof userIdToRemove !== "string") {
      throw new Error("userIdToRemove không hợp lệ");
    }

    // Lấy thông tin nhóm hiện tại
    const conversation = await conversationRepository.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc trò chuyện");
    }

    // Kiểm tra quyền của người dùng hiện tại
    if (!conversation.participantsIds.includes(currentUserId)) {
      throw new Error("Bạn không có quyền truy cập cuộc trò chuyện này");
    }
    if (conversation.leaderId !== currentUserId) {
      throw new Error("Chỉ trưởng nhóm mới có quyền xóa thành viên");
    }

    // Kiểm tra xem người dùng cần xóa có trong nhóm không
    if (!conversation.participantsIds.includes(userIdToRemove)) {
      throw new Error("Người dùng không phải là thành viên của nhóm này");
    }

    // Không cho phép trưởng nhóm tự xóa chính mình
    if (userIdToRemove === conversation.leaderId) {
      throw new Error(
        "Trưởng nhóm không thể tự xóa chính mình. Hãy rời nhóm hoặc giải tán nhóm."
      );
    }

    // Xóa người dùng khỏi nhóm
    await conversationRepository.removeUserFromConversation(
      conversationId,
      userIdToRemove
    );

    // Cập nhật listConversation của người dùng bị xóa trong bảng User
    const user = await userRepository.findById(userIdToRemove);
    if (user) {
      const updatedListConversation = (user.listConversation || []).filter(
        (convId) => convId !== conversationId
      );
      await userRepository.updateUser(userIdToRemove, {
        listConversation: updatedListConversation,
      });
    }
  } catch (error: any) {
    throw new Error(`Không thể xóa thành viên khỏi nhóm: ${error.message}`);
  }
};
