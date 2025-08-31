package org.tio.chat.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.session.SqlSession;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.mapper.ChatGroupMapper;
import org.tio.chat.model.ChatGroup;
import org.tio.chat.model.ChatGroupMember;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.util.JsonUtil;
import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.websocket.common.WsResponse;

import java.util.*;

import com.github.pagehelper.PageHelper;


import static org.tio.chat.service.ChatService.*;

@Slf4j
public class ChatGroupService {

    private static ChatGroupMapper chatGroupMapper;


    public ChatGroupService(ChatGroupMapper chatGroupMapper) {
        this.chatGroupMapper = chatGroupMapper;
    }


    // 查找群主 ID
    public static String findOwnerId(String groupId) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper mapper = sqlSession.getMapper(ChatGroupMapper.class);
            return mapper.findOwnerId(groupId);
        }
    }

    // 添加群成员
    public static boolean addMember(String groupId, String userId, String role) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper mapper = sqlSession.getMapper(ChatGroupMapper.class);
            ChatGroupMember member = new ChatGroupMember();
            member.setUserId(userId);
            member.setGroupId(groupId);
            member.setRole("member");
            return mapper.addMember(member) > 0;
        }
    }


    /**
     * 创建群
     * @param ownerId
     * @param groupName
     * @param memberIds
     * @param ctx
     * @return
     */
    public static ChatGroup createGroup(String ownerId, String groupName, List<String> memberIds, ChannelContext ctx) {
        if (ownerId == null || ownerId.trim().isEmpty()) throw new RuntimeException("ownerId required");
        if (groupName == null || groupName.trim().isEmpty()) throw new RuntimeException("groupName required");

        String groupId = "group_" + UUID.randomUUID().toString().replace("-", "");

        // 1) 持久化
        try (SqlSession s = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper mapper = s.getMapper(ChatGroupMapper.class);

            ChatGroup g = new ChatGroup();
            g.setGroupId(groupId);
            g.setGroupName(groupName);
            g.setOwnerId(ownerId);
            g.setAvatar(null);
            mapper.insertGroup(g);

            // 成员去重，确保 owner 在第一个
            LinkedHashSet<String> members = new LinkedHashSet<>();
            members.add(ownerId);
            if (memberIds != null) {
                for (String m : memberIds) {
                    if (m != null && !m.trim().isEmpty())
                        members.add(m.trim());
                }
            }

            for (String uid : members) {
                 String role = ownerId.equals(uid) ? "owner" : "member";
                ChatGroupMember member = new ChatGroupMember();
                member.setUserId(uid);
                member.setGroupId(groupId);
                member.setRole("member");
                 mapper.addMember(member);
            }

            // 查询回填
            ChatGroup out = mapper.getGroupById(groupId);

            // 2) 绑定创建者到 group
            if (ctx != null) {
                Tio.bindGroup(ctx, groupId);
            }


            return out;
        }
    }
    /**
     * 用户加入群聊
     *
     * @return
     */
    public static boolean joinGroup(String groupId, String userId, ChannelContext ctx) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper mapper = sqlSession.getMapper(ChatGroupMapper.class);

            // 检查用户是否已在群里
            ChatGroupMember existing = mapper.findMember(groupId, userId);
            if (existing == null) {
                String role = "member";

                ChatGroupMember member = new ChatGroupMember();
                member.setUserId(userId);
                member.setGroupId(groupId);
                member.setRole("member");
                mapper.addMember(member);
                // tio 层绑定群
                Tio.bindGroup(ctx, groupId);
                log.info("用户 [{}] 以角色 [{}] 加入群 [{}]", userId, role, groupId);
                return true;
            } else {
                log.info("用户 [{}] 已在群 [{}] 中，无需重复加入", userId, groupId);
                return false;
            }
        }

    }

    public static void leaveGroup(String groupId, String userId, ChannelContext ctx) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper mapper = sqlSession.getMapper(ChatGroupMapper.class);
            mapper.removeMember(groupId, userId);
        }
        Tio.unbindGroup(groupId, ctx);
    }

    // 群组列表展示
    public static List<ChatGroup> getGroupsByUser(String userId) {
        try (SqlSession s = SQL_SESSION_FACTORY.openSession()) {
            ChatGroupMapper groupMapper = s.getMapper(ChatGroupMapper.class);
            return groupMapper.getUserGroupObjects(userId);
        }
    }

    /**
     * 获取群成员
     */
    public List<String> getGroupMembers(String groupId) {
        try (SqlSession s = SQL_SESSION_FACTORY.openSession()) {
            ChatGroupMapper groupMapper = s.getMapper(ChatGroupMapper.class);
            return groupMapper.getGroupMembers(groupId);
        }
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
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);
            return groupMapper.getLastReadCursor(groupId, userId);
        }
    }

    /**
     * 上线补发所有群的“游标之后”的历史消息（优先redis,不足回落db）
     */
    public static List<ChatMessage> replayGroupHistoryForWindow(String userId, String groupId) {
        if (userId == null || groupId == null) return Collections.emptyList();

        // 获取用户在该群的最后已读游标
        String lastCursor = R.get(groupCursorKey(groupId, userId));
        List<ChatMessage> toReplay = new ArrayList<>();

        // 1) 先从 Redis 最近消息中过滤 > cursor 的部分
        List<String> raw = R.lrange(groupMsgKey(groupId), 0, GROUP_RECENT_MAX - 1);
        List<ChatMessage> recent = new ArrayList<>();
        for (String s : raw) {
            try { recent.add(JsonUtil.fromJson(s, ChatMessage.class)); } catch (Exception ignore) {}
        }
        toReplay = filterAfterCursor(recent, lastCursor);

        // 2) Redis 不足，回落 DB
        if ((toReplay == null || toReplay.isEmpty()) && lastCursor != null) {
            toReplay = fetchGroupHistorySince(groupId, lastCursor, 200);
        }

        return toReplay != null ? toReplay : Collections.emptyList();
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
        notify.setCreateTime(cursorMsg.getCreateTime());

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
            try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
                ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);
                cursorTime = groupMapper.getCreateTimeByMsgId(lastCursor);
            }// 根据 msgId 查询 create_time
        } else {
            cursorTime = new Date(); // 默认最新时间
        }

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession()) {
            ChatGroupMapper mapper = sqlSession.getMapper(ChatGroupMapper.class);

            // 分页查询
            PageHelper.startPage(pageNum, pageSize);
            List<ChatMessage> messages = mapper.selectGroupHistory(groupId, cursorTime);
            if (messages != null) {
                for (ChatMessage msg : messages) {
                    msg.setType("group"); // 给每条消息设置 type 为 group
                }
            }
            return messages;
        }
    }
}
