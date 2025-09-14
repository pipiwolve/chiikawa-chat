package org.tio.chat.service;

import com.github.pagehelper.PageHelper;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.constant.ChatConst;
import org.tio.chat.mapper.ChatGroupMapper;
import org.tio.chat.mapper.ChatMessageMapper;
import org.tio.chat.mapper.ChatUserMapper;
import org.tio.chat.model.ChatGroup;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.model.ChatUser;
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
    static final TioConfig TIO = ChatServerStarter.getTioServerConfig();

    // -------------------- MyBatis（无 Spring） --------------------
    static final SqlSessionFactory SQL_SESSION_FACTORY;
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
    static final RedisCommands<String, String> R = CONN.sync();

    /** 私聊离线消息 Redis Key: offline:{userId}:{peerId} */
    private static String offlineKey(String userId, String peerId) {
        return "offline:" + userId + ":" + peerId;
    }

    /** 私聊离线已读回执 Redis Key: readAck:{userId}:{peerId} */
    private static String readAckKey(String userId, String peerId) {
        return "readAck:" + userId + ":" + peerId;
    }

    // 群聊 Redis Key
    static String groupMsgKey(String groupId){ return "chat:group:msgs:" + groupId; }
    static String groupCursorKey(String groupId, String userId){ return "chat:group:cursor:" + groupId + ":" + userId; }
    static final int GROUP_RECENT_MAX = 200;

    // 在线消息内存索引 + TTL
    private static final long ONLINE_INDEX_TTL_MS = 10 * 60 * 1000L;
    private static final ConcurrentHashMap<String, OnlineEntry> onlineMsgMap = new ConcurrentHashMap<>();
    private static class OnlineEntry {
        final ChatMessage msg;
        final long ts;
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


    // -------------------- 私聊 --------------------
    public static void sendPrivateMsg(ChatMessage chatMessage, ChannelContext ctx) {
        if (chatMessage == null || chatMessage.getToUser() == null) return;

        chatMessage.setCmd(2);
        chatMessage.setGroupId(null);
        boolean receiverOnline = isUserOnline(ctx.tioConfig, chatMessage.getToUser());
        chatMessage.setOffline(!receiverOnline);

        insertMessage(chatMessage);

        if (receiverOnline) {
            WsResponse resp = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);
            Tio.sendToUser(ctx.tioConfig, chatMessage.getToUser(), resp);
        }

        if (chatMessage.getMsgId() != null) {
            onlineMsgMap.put(chatMessage.getMsgId(), new OnlineEntry(chatMessage));
            pruneOnlineIndex();
        }
    }

    // -------------------- 群聊 --------------------
    public static void sendGroupMsg(ChatMessage chatMessage, ChannelContext ctx) {
        if (chatMessage == null || chatMessage.getGroupId() == null) return;

        chatMessage.setCmd(3);
        chatMessage.setOffline(false);
        insertMessage(chatMessage);

        String json = JsonUtil.toJson(chatMessage);
        R.lpush(groupMsgKey(chatMessage.getGroupId()), json);
        R.ltrim(groupMsgKey(chatMessage.getGroupId()), 0, GROUP_RECENT_MAX - 1);

        WsResponse resp = WsResponse.fromText(json, ChatServerConfig.CHARSET);
        Tio.sendToGroup(ctx.tioConfig, chatMessage.getGroupId(), resp);
    }

    // -------------------- 消息入库 + 缓存 --------------------
    private static void insertMessage(ChatMessage msg) {
        try (SqlSession s = SQL_SESSION_FACTORY.openSession(true)) {
            ChatMessageMapper m = s.getMapper(ChatMessageMapper.class);
            m.insert(msg);
        }
        if (Boolean.TRUE.equals(msg.isOffline())) {
            cacheOfflineMessage(msg);
        }
    }

    private static void cacheOfflineMessage(ChatMessage msg) {
        if (msg == null || msg.getToUser() == null || msg.getFromUser() == null) return;
        R.rpush(offlineKey(msg.getToUser(), msg.getFromUser()), JsonUtil.toJson(msg));
        R.expire(offlineKey(msg.getToUser(), msg.getFromUser()), 86400);
    }

    // -------------------- 拉取离线消息 --------------------
    public static List<ChatMessage> getOfflineMessages(String userId, String peerId) {
        if (userId == null || peerId == null) return Collections.emptyList();

        List<ChatMessage> result = new ArrayList<>();
        String key = offlineKey(userId, peerId);

        List<String> cached = R.lrange(key, 0, -1);
        if (cached != null && !cached.isEmpty()) {
            for (String s : cached) {
                ChatMessage msg = JsonUtil.fromJson(s, ChatMessage.class);
                if (msg != null) result.add(msg);
            }
            R.del(key);
            return result;
        }

        try (SqlSession s = SQL_SESSION_FACTORY.openSession()) {
            ChatMessageMapper m = s.getMapper(ChatMessageMapper.class);
            result = m.selectOfflinePrivate(userId, peerId);
        }

        if (!result.isEmpty()) {
            for (ChatMessage msg : result) {
                R.rpush(key, JsonUtil.toJson(msg));
            }
            R.expire(key, 86400);
        }
        return result;
    }

    // -------------------- 标记已投递 --------------------
    public static void markOfflineMessagesDelivered(String userId, String peerId) {
        if (userId == null || peerId == null) return;
        try (SqlSession s = SQL_SESSION_FACTORY.openSession(true)) {
            ChatMessageMapper m = s.getMapper(ChatMessageMapper.class);
            m.markDeliveredByToUser(userId, peerId);
        }
        R.del(offlineKey(userId, peerId));
    }

    // -------------------- 私聊离线已读回执 --------------------
    public static void saveOfflineReadReceipt(String senderId, ChatMessage readAck) {
        if (senderId == null || readAck == null) return;
        R.rpush(readAckKey(senderId, readAck.getFromUser()), JsonUtil.toJson(readAck));
    }

    public static List<ChatMessage> getOfflineReadReceipts(String userId, String peerId) {
        if (userId == null || peerId == null) return Collections.emptyList();
        List<String> list = R.lrange(readAckKey(userId, peerId), 0, -1);
        List<ChatMessage> rs = new ArrayList<>();
        for (String s : list) rs.add(JsonUtil.fromJson(s, ChatMessage.class));
        return rs;
    }

    public static void clearOfflineReadReceipts(String userId, String peerId) {
        if (userId == null || peerId == null) return;
        R.del(readAckKey(userId, peerId));
    }

    public static List<ChatMessage> loadPrivateHistory(String userId, String peerId, Integer pageNum, Integer pageSize) {
        if (userId == null || peerId == null) return Collections.emptyList();
        pageNum = pageNum != null ? pageNum : 1;
        pageSize = pageSize != null ? pageSize : 20;

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession()) {
            ChatMessageMapper mapper = sqlSession.getMapper(ChatMessageMapper.class);
            // 如果使用 PageHelper：
            PageHelper.startPage(pageNum, pageSize);
            List<ChatMessage> messages = mapper.selectPrivateHistory(userId, peerId);
            if (messages == null) return Collections.emptyList();
            return messages;
        }
    }

    // -------------------- 处理已读确认 -> 生成回执 --------------------
    public static void processReadAck(List<String> msgIds, String readerId, ChannelContext ctx) {
        if (readerId == null || msgIds == null || msgIds.isEmpty()) return;

        ConcurrentHashMap<String, List<String>> ackBySender = new ConcurrentHashMap<>();
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

        // 2. 数据库更新 is_read 字段
        try (SqlSession session = SQL_SESSION_FACTORY.openSession(true)) {
            ChatMessageMapper mapper = session.getMapper(ChatMessageMapper.class);

            // 更新这些消息为已读（限定 to_user = readerId）
            mapper.markReadByMsgIds(msgIds, readerId);

            // 如果 onlineMap 没找到某些消息，也要从 DB 查发送者
            List<ChatMessage> rows = mapper.selectFromByMsgIds(msgIds, readerId);
            if (rows != null) {
                for (ChatMessage r : rows) {
                    String sender = r.getFromUser();
                    if (sender != null) {
                        ackBySender.computeIfAbsent(sender, k -> new ArrayList<>()).add(r.getMsgId());
                    }
                }
            }
        }

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