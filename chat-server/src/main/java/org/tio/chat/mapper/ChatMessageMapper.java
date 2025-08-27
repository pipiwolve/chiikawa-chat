package org.tio.chat.mapper;

import org.apache.ibatis.annotations.Param;
import org.tio.chat.model.ChatMessage;

import java.util.List;

public interface ChatMessageMapper {

    /** 插入一条消息 */
    int insert(ChatMessage msg);

    /** 查询某用户的离线消息（is_offline = true） */
    List<ChatMessage> selectOfflineByToUser(@Param("toUser") String toUser);

    /** 将某用户的离线消息标记为已投递（is_offline = false） */
    int markDeliveredByToUser(@Param("toUser") String toUser);

    /** 批量标记消息为已读（只更新接收方为 readerId 的消息） */
    int markReadByMsgIds(@Param("msgIds") List<String> msgIds,
                         @Param("readerId") String readerId);

    // 按 msgIds 查询发送方（用于回执 fallback）
    List<ChatMessage> selectSendersByMsgIds(@Param("msgIds") List<String> msgIds);

    /**
     * 查询用户私聊最近消息
     * @param userId
     * @return
     */
    List<ChatMessage> selectRecentPrivateMessages(@Param("userId") String userId);

    /**
     * 计算私聊未读信息
     * @param userId
     * @param targetId
     * @return
     */
    Integer countUnreadPrivateMessages(@Param("userId")String userId,@Param("targetId") String targetId);

    /**
     * 查找最后一条群聊信息
     * @param groupId
     * @return
     */
    ChatMessage selectLastGroupMessage(@Param("groupId") String groupId);
}