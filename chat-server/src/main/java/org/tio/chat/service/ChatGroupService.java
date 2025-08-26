package org.tio.chat.service;

import org.apache.ibatis.session.SqlSession;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.mapper.ChatGroupMapper;
import org.tio.chat.model.ChatGroupMember;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.util.JsonUtil;
import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.websocket.common.WsResponse;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;


import static org.tio.chat.service.ChatService.*;

public class ChatGroupService {

    private static ChatGroupMapper chatGroupMapper;

    public ChatGroupService(ChatGroupMapper chatGroupMapper) {
        this.chatGroupMapper = chatGroupMapper;
    }

    /**
     * 用户加入群聊
     */
    public static void joinGroup(String groupId, String userId, ChannelContext ctx) {
        ChatGroupMember member = new ChatGroupMember();
        member.setGroupId(groupId);
        member.setUserId(userId);
        chatGroupMapper.addMember(member);

        // 在线绑定
        Tio.bindGroup(ctx, groupId);
    }

    /**
     * 获取群成员
     */
    public List<String> getGroupMembers(String groupId) {
        return chatGroupMapper.getGroupMembers(groupId);
    }

    /**
     * 从 DB 获取用户所在的所有群 ID
     */
    public static List<String> getUserGroupIds(String userId) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);
            return groupMapper.getUserGroups(userId);
        }
    }

    /**
     * 更新群聊已读游标（DB + Redis）
     */
    public static void updateGroupReadCursor(String userId, String groupId, String lastMsgId) {
        if (userId == null || groupId == null) return;
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);
            groupMapper.upsertCursor(userId, groupId, lastMsgId);
        }
        if (lastMsgId != null) {
            R.set(groupCursorKey(groupId, userId), lastMsgId);
        }
    }

    /**
     * 获取群已读游标
     */
    public String getLastReadCursor(String groupId, String userId) {
        return chatGroupMapper.getLastReadCursor(groupId, userId);
    }


    /**
     * 上线补发所有群的“游标之后”的历史消息（优先redis,不足回落db）
     */
    public static void replayGroupHistoryOnLogin(String userId, ChannelContext ctx) {
        if (userId == null) return;
        List<String> groupIds = getUserGroupIds(userId);
        if (groupIds == null || groupIds.isEmpty()) return;

        for (String gid : groupIds) {
            String lastCursor = R.get(groupCursorKey(gid, userId)); // msgId 或 null

            // 1) 先从 Redis 最近消息中过滤 > cursor 的部分
            List<String> raw = R.lrange(groupMsgKey(gid), 0, GROUP_RECENT_MAX - 1);
            List<ChatMessage> recent = new ArrayList<>();
            for (String s : raw) {
                try {
                    recent.add(JsonUtil.fromJson(s, ChatMessage.class));
                } catch (Exception ignore) {
                }
            }
            List<ChatMessage> toReplay = filterAfterCursor(recent, lastCursor);

            // 2) 若不足且存在 cursor，则回落 DB 查询 cursor 之后的消息
            if ((toReplay == null || toReplay.isEmpty()) && lastCursor != null) {
                toReplay = fetchGroupHistorySince(gid, lastCursor, 200);
            }

            if (toReplay != null && !toReplay.isEmpty()) {
                // 一次性批量推送（数组）
                String payload = JsonUtil.toJson(toReplay);
                WsResponse resp = WsResponse.fromText(payload, ChatServerConfig.CHARSET);
                Tio.sendToUser(ctx.tioConfig, userId, resp);
            }
        }
    }
    /**
     * 过滤出 msgId > cursor 的消息（如果 cursor 为 null，返回所有）
     */
    private static List<ChatMessage> filterAfterCursor(List<ChatMessage> list, String cursorMsgId) {
        if (list == null || list.isEmpty()) return Collections.emptyList();
        if (cursorMsgId == null) return list;
        List<ChatMessage> out = new ArrayList<>();
        boolean passed = false;
        for (int i = list.size() - 1; i >= 0; i--) { // Redis lpush 可能是新在前，这里双向兼容
            ChatMessage m = list.get(i);
            if (m == null) continue;
            if (cursorMsgId.equals(m.getMsgId())) {
                passed = true;
                out.clear();
                continue;
            }
            if (passed) out.add(m);
        }
        if (!passed) {
            // Redis窗口内未找到 cursor，交给 DB 回落更稳妥，这里返回空
            return Collections.emptyList();
        }
        return out;
    }

    /**
     * 从 DB 回溯获取 groupId 中 cursorMsgId 之后的消息（最多 limit 条）
     */
    public static List<ChatMessage> fetchGroupHistorySince(String groupId, String cursorMsgId, int limit) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);
            return groupMapper.selectGroupMessagesSince(groupId, cursorMsgId, limit);
        }
    }

    /**
     * 广播群聊读取信息情况
     */

    public static void broadcastGroupCursor(ChatMessage cursorMsg, ChannelContext ctx) {
        if (cursorMsg == null || cursorMsg.getGroupId() == null) return;

        // 构造广播消息
        ChatMessage notify = new ChatMessage();
        notify.setCmd(102);
        notify.setFromUser(cursorMsg.getFromUser());
        notify.setGroupId(cursorMsg.getGroupId());
        notify.setMsgId(cursorMsg.getMsgId()); // 表示读到哪个 msgId
        notify.setTimestamp(System.currentTimeMillis());

        WsResponse resp = WsResponse.fromText(JsonUtil.toJson(notify), ChatServerConfig.CHARSET);
        // 广播给群里所有人（包括发送方自己，可根据需求排除）
        Tio.sendToGroup(ctx.tioConfig, cursorMsg.getGroupId(), resp);
    }

    public static List<ChatMessage> loadGroupHistory(String userId, String groupId, Integer pageNum, Integer pageSize) {
        if (userId == null || groupId == null) return Collections.emptyList();
        pageNum = pageNum != null ? pageNum : 1;
        pageSize = pageSize != null ? pageSize : 20;

        // 获取用户群已读游标
        String lastCursor = R.get(groupCursorKey(groupId, userId));
        Date cursorTime = null;
        if (lastCursor != null) {
            cursorTime = chatGroupMapper.getCreateTimeByMsgId(lastCursor); // 根据 msgId 查询 create_time
        } else {
            cursorTime = new Date(); // 默认最新时间
        }

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession()) {
            ChatGroupMapper mapper = sqlSession.getMapper(ChatGroupMapper.class);

            // 分页查询
            PageHelper.startPage(pageNum, pageSize);
            List<ChatMessage> messages = mapper.selectGroupHistory(groupId, cursorTime);

            return messages != null ? messages : Collections.emptyList();
        }
    }
}
