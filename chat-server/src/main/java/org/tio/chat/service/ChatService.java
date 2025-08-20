package org.tio.chat.service;

import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.constant.ChatConst;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.starter.ChatServerStarter;
import org.tio.chat.util.JsonUtil;
import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.core.TioConfig;
import org.tio.utils.lock.SetWithLock;
import org.tio.websocket.common.WsResponse;

import java.io.IOException;
import java.io.Reader;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ChatService
 * - 消息入库（MySQL / MyBatis）
 * - 离线消息缓存（Redis List: offline:{userId}）
 * - 离线已读回执缓存（Redis List: readAck:{senderId}）
 * - 在线消息内存索引（onlineMsgMap，仅用于快速已读匹配，带TTL清理）
 */
public class ChatService {

    // -------------------- T-IO 全局配置 --------------------
    private static final TioConfig TIO = ChatServerStarter.getTioServerConfig();

    // -------------------- MyBatis（无 Spring） --------------------
    private static final SqlSessionFactory SQL_SESSION_FACTORY;
    static {
        try (Reader reader = Resources.getResourceAsReader("mybatis-config.xml")) {
            SQL_SESSION_FACTORY = new SqlSessionFactoryBuilder().build(reader);
        } catch (IOException e) {
            throw new RuntimeException("加载 mybatis-config.xml 失败", e);
        }
    }

    // -------------------- Redis（Lettuce） --------------------
    private static final RedisClient REDIS = RedisClient.create("redis://localhost:6379");
    private static final StatefulRedisConnection<String, String> CONN = REDIS.connect();
    private static final RedisCommands<String, String> R = CONN.sync();

    private static String offlineKey(String userId) { return "offline:" + userId; }
    private static String readAckKey(String userId) { return "readAck:" + userId; }

    // -------------------- 在线消息内存索引 + TTL --------------------
    private static final long ONLINE_INDEX_TTL_MS = 10 * 60 * 1000L; // 10分钟
    private static final ConcurrentHashMap<String, OnlineEntry> onlineMsgMap = new ConcurrentHashMap<>();

    private static class OnlineEntry {
        final ChatMessage msg;
        final long ts; // 放入时间
        OnlineEntry(ChatMessage msg) { this.msg = msg; this.ts = System.currentTimeMillis(); }
        boolean expired() { return System.currentTimeMillis() - ts > ONLINE_INDEX_TTL_MS; }
    }

    private static void pruneOnlineIndex() {
        for (Map.Entry<String, OnlineEntry> e : onlineMsgMap.entrySet()) {
            if (e.getValue() == null || e.getValue().expired()) {
                onlineMsgMap.remove(e.getKey());
            }
        }
    }

    // -------------------- 绑定/分发 --------------------

    /** 绑定用户并加入默认群组（如 "group1"） */
    public static void bindUser(String userId, ChannelContext ctx) {
        if (userId == null) return;
        Tio.bindUser(ctx, userId);
        Tio.bindGroup(ctx, ChatConst.GROUP_1);
    }

    /** 私聊：写库 -> 在线判断 -> 发送或缓存离线 -> 维护在线索引 */
    public static void sendPrivateMsg(ChatMessage chatMessage, ChannelContext ctx) {
        if (chatMessage == null || chatMessage.getToUser() == null) return;

        // 1) 写库：cmd=2, to_user=..., group_id=null, is_offline 在线判断后回填
        chatMessage.setCmd(2);
        chatMessage.setGroupId(null);

        // ? 在线判断 ？
        boolean receiverOnline = isUserOnline(ctx.tioConfig, chatMessage.getToUser());
        chatMessage.setOffline(!receiverOnline);

        insertMessage(chatMessage);

        // 2) 在线 -> 推送；离线 -> Redis 缓存
        if (receiverOnline) {
            WsResponse resp = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);
            Tio.sendToUser(ctx.tioConfig, chatMessage.getToUser(), resp);
        }

        // 3) 维护在线索引（用于后续已读快速匹配）
        if (chatMessage.getMsgId() != null) {
            onlineMsgMap.put(chatMessage.getMsgId(), new OnlineEntry(chatMessage));
            pruneOnlineIndex();
        }
    }

    /** 群聊：写库 -> 群发（不做已读逻辑） */
    public static void sendGroupMsg(ChatMessage chatMessage, ChannelContext ctx) {
        if (chatMessage == null || chatMessage.getGroupId() == null) return;
        final String gid = chatMessage.getToUser();
        chatMessage.setCmd(3);
        chatMessage.setGroupId(gid);
        chatMessage.setToUser(null); // 群聊不使用 to_user
        chatMessage.setOffline(false); // 群聊不计离线（历史另行查询）

        insertMessage(chatMessage);

        WsResponse resp = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);
        Tio.sendToGroup(ctx.tioConfig, chatMessage.getGroupId(), resp);
    }

    // -------------------- 离线消息（消息体） --------------------

    /** 入库 + 可选写缓存（Redis） */
    private static void insertMessage(ChatMessage msg) {
        try (SqlSession s = SQL_SESSION_FACTORY.openSession(true)) {
            org.tio.chat.mapper.ChatMessageMapper m = s.getMapper(org.tio.chat.mapper.ChatMessageMapper.class);
            m.insert(msg);
        }
        // 如果是离线消息，写入 Redis 缓存以便上线时快速推送
            if (Boolean.TRUE.equals(msg.isOffline())) {
            cacheOfflineMessage(msg);
        }
    }

    /** 仅写离线缓存（被 sendPrivateMsg/insertMessage 调用） */
    private static void cacheOfflineMessage(ChatMessage msg) {
        if (msg == null || msg.getToUser() == null) return;
        R.rpush(offlineKey(msg.getToUser()), JsonUtil.toJson(msg));
        R.expire(offlineKey(msg.getToUser()), 86400); // 1天有效期
    }

    /**
     * 拉取离线消息：
     * - 先查 Redis (带 TTL，1天)
     * - 如果 Redis 没有或过期，则查 DB (is_offline=true)
     * - 拉取后立即清理 Redis，避免重复推送
     */
    public static List<ChatMessage> getOfflineMessages(String userId) {
        if (userId == null) return Collections.emptyList();

        List<ChatMessage> result = new ArrayList<>();

        // ---------------- 1) 优先查 Redis ----------------
        List<String> cached = R.lrange(offlineKey(userId), 0, -1);
        if (cached != null && !cached.isEmpty()) {
            for (String s : cached) {
                ChatMessage msg = JsonUtil.fromJson(s, ChatMessage.class);
                if (msg != null) {
                    result.add(msg);
                }
            }
            // 一旦取出，清理 Redis 缓存，防止重复推送
            R.del(offlineKey(userId));
            return result;
        }

        // ---------------- 2) fallback 查 DB ----------------
        try (SqlSession s = SQL_SESSION_FACTORY.openSession()) {
            org.tio.chat.mapper.ChatMessageMapper m = s.getMapper(org.tio.chat.mapper.ChatMessageMapper.class);
            result = m.selectOfflineByToUser(userId);
        }

        // ---------------- 3) DB 查询到的消息再次写入 Redis 缓存 ----------------
        if (!result.isEmpty()) {
            for (ChatMessage msg : result) {
                R.rpush(offlineKey(userId), JsonUtil.toJson(msg));
            }
            R.expire(offlineKey(userId), 86400); // 1天 TTL
        }

        return result;
    }

    /** 标记某用户的离线消息“已投递/已合并”，DB: is_offline=false；Redis: 清空列表 */
    public static void markOfflineMessagesDelivered(String userId) {
        if (userId == null) return;
        try (SqlSession s = SQL_SESSION_FACTORY.openSession(true)) {
            org.tio.chat.mapper.ChatMessageMapper m = s.getMapper(org.tio.chat.mapper.ChatMessageMapper.class);
            m.markDeliveredByToUser(userId);
        }
        R.del(offlineKey(userId));
    }

    // -------------------- 离线已读回执（Redis） --------------------

    public static void saveOfflineReadReceipt(String senderId, ChatMessage readAck) {
        if (senderId == null || readAck == null) return;
        R.rpush(readAckKey(senderId), JsonUtil.toJson(readAck));
    }

    public static List<ChatMessage> getOfflineReadReceipts(String userId) {
        if (userId == null) return Collections.emptyList();
        List<String> list = R.lrange(readAckKey(userId), 0, -1);
        List<ChatMessage> rs = new ArrayList<>();
        for (String s : list) rs.add(JsonUtil.fromJson(s, ChatMessage.class));
        return rs;
    }

    public static void clearOfflineReadReceipts(String userId) {
        if (userId == null) return;
        R.del(readAckKey(userId));
    }

    // -------------------- 已读确认(100) -> 已读回执(101) --------------------

    /**
     * @param msgIds   接收方声明已读的消息ID集合
     * @param readerId 已读的接收方（当前登录用户）
     * @param ctx      当前连接（取 tioConfig 用）
     */
    public static void processReadAck(List<String> msgIds, String readerId, ChannelContext ctx) {
        if (readerId == null || msgIds == null || msgIds.isEmpty()) return;

        // ------------------ 0) DB 永久存储，强制批量标记已读 ------------------
        try (SqlSession s = SQL_SESSION_FACTORY.openSession(true)) {
            org.tio.chat.mapper.ChatMessageMapper m = s.getMapper(org.tio.chat.mapper.ChatMessageMapper.class);
            m.markReadByMsgIds(msgIds, readerId);
        }

        // ------------------ 1) Redis 离线缓存匹配（TTL 24h） ------------------
        ConcurrentHashMap<String, List<String>> ackBySender = new ConcurrentHashMap<>();

        List<String> cached = R.lrange(offlineKey(readerId), 0, -1);
        if (cached != null && !cached.isEmpty()) {
            for (String s : cached) {
                ChatMessage m = JsonUtil.fromJson(s, ChatMessage.class);
                if (m != null && msgIds.contains(m.getMsgId())) {
                    m.setIsRead(true);
                    if (m.getFromUser() != null) {
                        ackBySender.computeIfAbsent(m.getFromUser(), k -> new ArrayList<>()).add(m.getMsgId());
                    }
                }
            }
            // 不强制回写 Redis，因为 Redis 只是临时缓存，DB 已经是已读状态
        }

        // ------------------ 2) 在线内存索引匹配（10min TTL） ------------------
        pruneOnlineIndex();
        for (String mid : msgIds) {
            OnlineEntry oe = onlineMsgMap.get(mid);
            if (oe != null && oe.msg != null) {
                oe.msg.setIsRead(true);
                String sender = oe.msg.getFromUser();
                if (sender != null) {
                    ackBySender.computeIfAbsent(sender, k -> new ArrayList<>()).add(mid);
                }
            }
        }

        // ------------------ 3) 批量生成已读回执 101 ------------------
        final TioConfig tioCfg = (ctx != null ? ctx.tioConfig : TIO);

        for (Map.Entry<String, List<String>> e : ackBySender.entrySet()) {
            String senderId = e.getKey();
            List<String> ids = e.getValue();
            if (senderId == null || ids == null || ids.isEmpty()) continue;

            ChatMessage readAck = new ChatMessage();
            readAck.setCmd(101);
            readAck.setFromUser(readerId);
            readAck.setToUser(senderId);
            readAck.setMsgIds(ids);

            WsResponse resp = WsResponse.fromText(JsonUtil.toJson(readAck), ChatServerConfig.CHARSET);

            if (isUserOnline(tioCfg, senderId)) {
                Tio.sendToUser(tioCfg, senderId, resp);
            } else {
                saveOfflineReadReceipt(senderId, readAck);
            }
        }
    }

    // -------------------- 辅助：在线判断 --------------------

    /** 封装统一的在线判断，兼容旧 API */
    private static boolean isUserOnline(TioConfig cfg, String userId) {
        if (userId == null) return false;
        SetWithLock<ChannelContext> swl = Tio.getChannelContextsByUserid(cfg, userId);
        return swl != null && swl.getObj() != null && !swl.getObj().isEmpty();
    }
}