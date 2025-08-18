package org.tio.chat.service;

import org.tio.chat.starter.ChatServerStarter;
import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.core.TioConfig;
import org.tio.utils.lock.SetWithLock;
import org.tio.websocket.common.WsResponse;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.util.JsonUtil;
import org.tio.chat.config.ChatServerConfig;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ChatService 负责聊天业务逻辑，包括消息转发、离线消息与离线已读回执管理。
 * 简化后的确认机制：只有“已读确认(100)”与“已读回执(101)”，不做送达ACK(-1)。
 */
public class ChatService {

    // 全局 T-IO 配置（由 Starter 初始化）
    private static final TioConfig config = ChatServerStarter.getTioServerConfig();

    // 离线消息缓存：key = 接收方 userId，value = 该用户未取走的离线消息列表
    private static final ConcurrentHashMap<String, List<ChatMessage>> offlineMsgMap = new ConcurrentHashMap<>();

    // 在线消息索引：key = msgId，value = ChatMessage（仅存必要字段，不存 ChannelContext）
    private static final ConcurrentHashMap<String, ChatMessage> onlineMsgMap = new ConcurrentHashMap<>();

    // 离线已读回执缓存：key = 发送方 userId，value = 待推送给该发送方的“已读回执(101)”消息列表
    private static final ConcurrentHashMap<String, List<ChatMessage>> offlineReceiptMap = new ConcurrentHashMap<>();

    /** 绑定用户并加入默认群组（如 "group1"） */
    public static void bindUser(String userId, ChannelContext channelContext) {
        Tio.bindUser(channelContext, userId);
        Tio.bindGroup(channelContext, "group1");
    }

    /** 发送私聊消息 */
    public static void sendPrivateMsg(ChatMessage chatMessage, ChannelContext channelContext) {
        String toUserId = chatMessage.getTo();
        WsResponse response = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);
        Tio.sendToUser(channelContext.tioConfig, toUserId, response);
    }

    /** 发送群聊消息 */
    public static void sendGroupMsg(ChatMessage chatMessage, ChannelContext channelContext) {
        String groupId = chatMessage.getTo();
        WsResponse response = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);
        Tio.sendToGroup(channelContext.tioConfig, groupId, response);
    }

    /** 保存离线消息（按接收方归档） */
    public static void saveOfflineMessage(ChatMessage msg) {
        if (msg == null || msg.getTo() == null) return;
        offlineMsgMap.compute(msg.getTo(), (userId, list) -> {
            if (list == null) list = new ArrayList<>();
            list.add(msg);
            return list;
        });
    }

    /** 保存“在线消息索引”（仅缓存必要字段，不存 ChannelContext） */
    public static void saveOnlineMessage(ChatMessage msg) {
        if (msg != null && msg.getMsgId() != null) {
            onlineMsgMap.put(msg.getMsgId(), msg);
        }
    }

    /** 查询指定用户的离线消息（无则返回空列表） */
    public static List<ChatMessage> getOfflineMessages(String userId) {
        if (userId == null) return Collections.emptyList();
        return offlineMsgMap.getOrDefault(userId, Collections.emptyList());
    }

    /** 清空指定用户离线消息（例如客户端已拉取/合并后） */
    public static void markOfflineMessagesRead(String userId) {
        if (userId != null) {
            offlineMsgMap.remove(userId);
        }
    }

    /** 保存离线“已读回执(101)” */
    public static void saveOfflineReadReceipt(String senderId, ChatMessage receipt) {
        if (senderId == null || receipt == null) return;
        offlineReceiptMap.compute(senderId, (k, list) -> {
            if (list == null) list = new ArrayList<>();
            list.add(receipt);
            return list;
        });
    }

    /** 取走某个发送方的离线“已读回执(101)” */
    public static List<ChatMessage> getOfflineReadReceipts(String senderId) {
        return offlineReceiptMap.getOrDefault(senderId, Collections.emptyList());
    }

    /** 清空某个发送方的离线“已读回执(101)” */
    public static void clearOfflineReadReceipts(String senderId) {
        offlineReceiptMap.remove(senderId);
    }

    /**
     * 处理“已读确认(100)”
     * 1) 将 msgIds 对应的消息（在线/离线）标记为已读；
     * 2) 按发送方聚合，生成“已读回执(101)”批量推送；
     * 3) 发送方不在线则写入 offlineReceiptMap，待其上线由 Listener 推送。
     *
     * @param msgIds    接收方声明已读的消息ID集合
     * @param readerId  发送 100 的接收方 userId（阅读者）
     * @param ctx       当前连接上下文（可为空；仅用于取 tioConfig）
     */
    public static void processReadAck(List<String> msgIds, String readerId, ChannelContext ctx) {
        if (msgIds == null || msgIds.isEmpty() || readerId == null) return;

        // senderId -> 待回执的 msgId 列表（批量聚合）
        ConcurrentHashMap<String, List<String>> ackBySender = new ConcurrentHashMap<>();

        // 1) 处理“离线消息列表”中的已读
        List<ChatMessage> offlineList = offlineMsgMap.get(readerId);
        if (offlineList != null && !offlineList.isEmpty()) {
            for (ChatMessage m : offlineList) {
                String mid = m.getMsgId();
                if (mid != null && msgIds.contains(mid)) {
                    m.setRead(true);
                    String sender = m.getFrom();
                    if (sender != null) {
                        ackBySender.compute(sender, (k, v) -> {
                            if (v == null) v = new ArrayList<>();
                            v.add(mid);
                            return v;
                        });
                    }
                }
            }
            // 这里不删除离线消息，仅标记已读，是否清理由业务决定
            offlineMsgMap.put(readerId, offlineList);
        }

        // 2) 处理“在线消息索引”中的已读
        for (String mid : msgIds) {
           ChatMessage online = onlineMsgMap.get(mid);
            if (online != null) {
                online.setRead(true);
                String sender = online.getFrom();
                if (sender != null) {
                    ackBySender.compute(sender, (k, v) -> {
                        if (v == null) v = new ArrayList<>();
                        v.add(mid);
                        return v;
                    });
                }
            }
        }

        // 3) 按发送方批量推送 “已读回执(101)”
        TioConfig tioCfg = (ctx != null ? ctx.tioConfig : config);

        for (String senderId : ackBySender.keySet()) {
            List<String> ids = ackBySender.get(senderId);
            if (ids == null || ids.isEmpty()) continue;

            ChatMessage readAck = new ChatMessage();
            readAck.setCmd(101);
            readAck.setFrom(readerId);
            readAck.setTo(senderId);
            readAck.setMsgIds(ids);

            WsResponse resp = WsResponse.fromText(JsonUtil.toJson(readAck), ChatServerConfig.CHARSET);

            SetWithLock<ChannelContext> swl = Tio.getChannelContextsByUserid(tioCfg, senderId);
            boolean online = swl != null && swl.getObj() != null && !swl.getObj().isEmpty();
            if (online) {
                // 发送方在线：直接下发 101
                Tio.sendToUser(tioCfg, senderId, resp);
            } else {
                // 发送方离线：写入离线回执缓存，待其上线由 Listener 推送
                saveOfflineReadReceipt(senderId, readAck);
            }
        }
    }
}