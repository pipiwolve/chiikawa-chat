package org.tio.chat.mapper;

import org.apache.ibatis.annotations.Param;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.model.ChatUser;

import java.util.List;

public interface ChatMessageMapper {

    /** 插入一条消息 */
    int insert(ChatMessage msg);


    /** 将某用户的离线消息标记为已投递（is_offline = false） */
    int markDeliveredByToUser(@Param("userId") String userId, @Param("peerId") String peerId);

    /** 批量标记消息为已读（只更新接收方为 readerId 的消息） */
    int markReadByMsgIds(@Param("msgIds") List<String> msgIds,
                         @Param("readerId") String readerId);

    // 按 msgIds 查询发送方（用于回执 fallback）
    List<ChatMessage> selectFromByMsgIds(@Param("msgIds") List<String> msgIds, @Param("readerId") String readerId);

    // 获取和某用户有过私聊的用户对象
    List<ChatUser> getPrivateChatUsers(@Param("userId") String userId);

    // 查询某个私聊对象的最后一条消息
    ChatMessage selectLastPrivateMessage(@Param("userId") String userId,
                                         @Param("peerId") String peerId);

    List<ChatMessage> selectPrivateHistory(@Param("userId") String userId, @Param("peerId") String peerId);

    /**
     * 计算私聊未读信息
     * @param userId
     * @param peerId
     * @return
     */
    Integer countUnreadPrivateMessages(@Param("userId")String userId,@Param("peerId") String peerId);

    /**
     * 查找最后一条群聊信息
     * @param groupId
     * @return
     */
    ChatMessage selectLastGroupMessage(@Param("groupId") String groupId);

    /**
     * 查询离线信息
     * @param userId
     * @param peerId
     * @return
     */
    List<ChatMessage> selectOfflinePrivate(@Param("userId")String userId, @Param("peerId") String peerId);
}