package org.tio.chat.mapper;

import org.apache.ibatis.annotations.Param;
import org.tio.chat.model.ChatGroup;
import org.tio.chat.model.ChatGroupMember;
import org.tio.chat.model.ChatMessage;

import java.util.Date;
import java.util.List;

/**
 * ChatGroupMapper
 *
 * 负责群聊相关的数据库操作，包括群组管理、群成员管理、群消息游标管理等
 */
public interface ChatGroupMapper {

    /**
     * 插入或更新用户在某个群聊中的已读游标
     *
     * @param userId       用户ID
     * @param groupId      群组ID
     * @param lastReadMsgId 最新已读消息ID
     */
    void upsertCursor(@Param("userId") String userId,
                      @Param("groupId") String groupId,
                      @Param("lastReadMsgId") String lastReadMsgId);

    /**
     * 添加群成员
     *
     * @param member ChatGroupMember 对象，包含 groupId 和 userId
     */
    void addMember(ChatGroupMember member);

    /**
     * 创建新的群组
     *
     * @param chatGroup ChatGroup 对象，包含 groupId、groupName 等信息
     */
    void insertGroup(ChatGroup chatGroup);

    /**
     * 获取群组中所有成员的用户ID列表
     *
     * @param groupId 群组ID
     * @return List<String> 成员用户ID列表
     */
    List<String> getGroupMembers(@Param("groupId") String groupId);

    /**
     * 获取用户所属的所有群组ID列表
     *
     * @param userId 用户ID
     * @return List<String> 群组ID列表
     */
    List<String> getUserGroups(@Param("userId") String userId);

    /**
     * 更新用户在群聊中的最后已读消息游标
     *
     * @param groupId 群组ID
     * @param userId  用户ID
     * @param msgId   最新已读消息ID
     */
    void updateLastReadCursor(@Param("groupId") String groupId,
                              @Param("userId") String userId,
                              @Param("msgId") String msgId);

    /**
     * 查询用户在某个群组的最后已读消息ID
     *
     * @param groupId 群组ID
     * @param userId  用户ID
     * @return 最后已读消息ID
     */
    String getLastReadCursor(@Param("groupId") String groupId,
                             @Param("userId") String userId);

    /**
     * 查询某个群组中从指定游标消息之后的消息列表
     *
     * @param groupId   群组ID
     * @param cursorMsgId 起始消息ID（游标）
     * @param limit     查询数量限制
     * @return List<ChatMessage> 消息列表
     */
    List<ChatMessage> selectGroupMessagesSince(@Param("groupId") String groupId,
                                               @Param("cursorMsgId") String cursorMsgId,
                                               @Param("limit") int limit);


    /**
     * 通过游标id取得游标时间
     * @param lastCursor
     * @return
     */
    Date getCreateTimeByMsgId(@Param("lastCursor") String lastCursor);

    /**
     * 加载历史信息
     * @param groupId
     * @param cursorTime
     * @return
     */
    List<ChatMessage> selectGroupHistory(@Param("groupId") String groupId,
                                         @Param("cursorTime") Date cursorTime);


}