// src/services/nicknameService.ts
import * as nicknameRepository from "../repository/NickNameRepository";

// Đổi tên ghi nhớ
export const setNickname = async (
  userId: string,
  targetUserId: string,
  nickname: string
) => {
  try {
    if (!userId || !targetUserId || !nickname) {
      throw new Error("Missing required fields");
    }

    // Kiểm tra xem đã có nickname hay chưa
    const existingNickname = await nicknameRepository.getNickname(
      userId,
      targetUserId
    );

    if (existingNickname) {
      // Nếu đã có, chỉ cập nhật nickname và updateAt
      await nicknameRepository.updateNickname(userId, targetUserId, nickname);
    } else {
      // Nếu chưa có, tạo mới bản ghi
      await nicknameRepository.saveNickname(userId, targetUserId, nickname);
    }

    return { message: "Nickname updated successfully" };
  } catch (error: any) {
    throw new Error(`Failed to set nickname: ${error.message}`);
  }
};

// Lấy tên ghi nhớ
export const getNickname = async (userId: string, targetUserId: string) => {
  try {
    const nickname = await nicknameRepository.getNickname(userId, targetUserId);
    return { nickname };
  } catch (error: any) {
    throw new Error(`Failed to get nickname: ${error.message}`);
  }
};
