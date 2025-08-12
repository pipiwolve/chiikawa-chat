package org.tio.chat.service;

import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.websocket.common.WsResponse;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.util.JsonUtil;
import org.tio.chat.config.ChatServerConfig;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ChatService 负责聊天业务逻辑，包括消息转发和离线消息管理。
 */
public class ChatService {

    // 离线消息缓存，key: 用户ID，value: 离线消息列表
    private static final ConcurrentHashMap<String, List<ChatMessage>> offlineMsgMap = new ConcurrentHashMap<>();

    /**
     * 绑定用户并加入默认群组（如 "group1"）
     */
    public static void bindUser(String userId, ChannelContext channelContext) {
        // 绑定用户ID
        Tio.bindUser(channelContext, userId);
        // 加入默认群组
        Tio.bindGroup(channelContext, "group1");
    }

    /**
     * 发送私聊消息给指定用户
     */
    public static void sendPrivateMsg(ChatMessage chatMessage, ChannelContext channelContext) {
        String toUserId = chatMessage.getTo();
        WsResponse response = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);

        // 直接调用 sendToUser，不依赖内部结构或额外方法，兼容所有版本
        Tio.sendToUser(channelContext.tioConfig, toUserId, response);
        // 如果需要检测在线状态，建议在业务层维护在线用户列表或通过其他机制
    }

    /**
     * 发送群聊消息给指定群组所有用户
     */
    public static void sendGroupMsg(ChatMessage chatMessage, ChannelContext channelContext) {
        String groupId = chatMessage.getTo(); // 群组ID
        WsResponse response = WsResponse.fromText(JsonUtil.toJson(chatMessage), ChatServerConfig.CHARSET);
        Tio.sendToGroup(channelContext.tioConfig, groupId, response);
    }

    /**
     * 保存离线消息
     */
    public static void saveOfflineMessage(ChatMessage msg) {
        if (msg == null || msg.getTo() == null) {
            return;
        }
        offlineMsgMap.compute(msg.getTo(), (userId, msgList) -> {
            if (msgList == null) {
                msgList = new ArrayList<>();
            }
            msgList.add(msg);
            return msgList;
        });
    }

    /**
     * 查询指定用户所有离线消息
     */
    public static List<ChatMessage> getOfflineMessages(String userId) {
        if (userId == null) {
            return new ArrayList<>();
        }
        List<ChatMessage> list = offlineMsgMap.get(userId);
        return list;
    }

    /**
     * 标记离线消息为已读（即清空该用户离线消息列表）
     */
    public static void markOfflineMessagesRead(String userId) {
        if (userId != null) {
            offlineMsgMap.remove(userId);
        }
    }

    /**
     * 处理客户端ACK确认，前端确认已收到消息后调用此接口
     */
    public static void processClientAck(String msgId, String userId) {
        if (msgId == null || userId == null) {
            return;
        }
        List<ChatMessage> msgList = offlineMsgMap.get(userId);
        if (msgList != null) {
            msgList.removeIf(msg -> msgId.equals(msg.getMsgId()));
            // 更新缓存
            if (msgList.isEmpty()) {
                offlineMsgMap.remove(userId);
            } else {
                offlineMsgMap.put(userId, msgList);
            }
        }
    }
}