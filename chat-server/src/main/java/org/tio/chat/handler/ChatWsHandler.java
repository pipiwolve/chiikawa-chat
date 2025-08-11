package org.tio.chat.handler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.constant.ChatConst;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.service.ChatService;
import org.tio.chat.util.JsonUtil;
import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.http.common.HttpRequest;
import org.tio.http.common.HttpResponse;
import org.tio.websocket.common.WsRequest;
import org.tio.websocket.common.WsResponse;
import org.tio.websocket.server.handler.IWsMsgHandler;

import java.util.List;
import java.util.UUID;

/**
 * ChatWsHandler 是 t-io WebSocket 服务端的核心消息处理器。
 * 负责 WebSocket 握手、连接管理及消息分发，业务逻辑委托给 ChatService。
 */
public class ChatWsHandler implements IWsMsgHandler {
    private static final Logger log = LoggerFactory.getLogger(ChatWsHandler.class);
    public static final ChatWsHandler me = new ChatWsHandler();

    private ChatWsHandler() {
    }

    /**
     * WebSocket 握手阶段，绑定用户ID，确保连接和用户绑定。
     */
    @Override
    public HttpResponse handshake(HttpRequest request, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        String clientIp = request.getClientIp();
        String userId = request.getParam("name");

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("握手失败，未传入有效的用户ID参数 name，客户端IP: {}", clientIp);
            return null;
        }

        Tio.bindUser(channelContext, userId);
        log.info("用户 [{}] 从 [{}] 发起 WebSocket 握手", userId, clientIp);

        return httpResponse;
    }

    /**
     * 握手完成后，加入默认群组并广播上线通知，使用统一的消息格式。
     */
    @Override
    public void onAfterHandshaked(HttpRequest httpRequest, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        // 绑定默认群组
        Tio.bindGroup(channelContext, ChatConst.GROUP_ID);

        // 获取当前在线人数
        int count = Tio.getAll(channelContext.tioConfig).getObj().size();

        // 构造系统上线消息
        ChatMessage sysMsg = new ChatMessage();
        sysMsg.setFrom("admin");
        sysMsg.setMessage(channelContext.userid + " 进来了，共【" + count + "】人在线");
        String jsonMsg = JsonUtil.toJson(sysMsg);

        // 广播上线消息到默认群组
        WsResponse wsResponse = WsResponse.fromText(jsonMsg, ChatServerConfig.CHARSET);
        Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);

        // 查询当前用户的离线消息
        List<ChatMessage> offlineMessages = ChatService.getOfflineMessages(channelContext.userid);

        // 推送离线消息给当前用户
        if (offlineMessages != null && !offlineMessages.isEmpty()) {
            for (ChatMessage offlineMsg : offlineMessages) {
                String offlineJson = JsonUtil.toJson(offlineMsg);
                WsResponse offlineResponse = WsResponse.fromText(offlineJson, ChatServerConfig.CHARSET);
                Tio.send(channelContext, offlineResponse);
            }
            // 标记离线消息已读或删除，避免重复推送
            ChatService.markOfflineMessagesRead(channelContext.userid);
        }
    }

    @Override
    public Object onBytes(WsRequest wsRequest, byte[] bytes, ChannelContext channelContext) throws Exception {
        // 不支持二进制消息，忽略
        return null;
    }

    @Override
    public Object onClose(WsRequest wsRequest, byte[] bytes, ChannelContext channelContext) throws Exception {
        // 连接关闭时的广播通知，属于连接生命周期事件，建议迁移

        // 移除连接
        Tio.remove(channelContext, "客户端主动关闭连接");

        // 获取当前在线人数
        int count = Tio.getAll(channelContext.tioConfig).getObj().size() - 1;

        // 构造下线消息
        ChatMessage sysMsg = new ChatMessage();
        sysMsg.setFrom("admin");
        sysMsg.setMessage(channelContext.userid + " 离开了，现在共有【" + count + "】人在线");
        String jsonMsg = JsonUtil.toJson(sysMsg);

        // 发送给默认群组，通知其他人
        WsResponse wsResponse = WsResponse.fromText(jsonMsg, ChatServerConfig.CHARSET);
        Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);

        return null;
    }


    /**
     * 核心的文本消息处理入口，调用 ChatService 处理业务逻辑。
     */
    @Override
    public Object onText(WsRequest wsRequest, String text, ChannelContext channelContext) throws Exception {
        if (log.isDebugEnabled()) {
            log.debug("收到客户端消息: {}", text);
        }

        ChatMessage chatMessage = null;
        try {
            chatMessage = JsonUtil.fromJson(text, ChatMessage.class);
        } catch (Exception e) {
            log.warn("消息解析失败，忽略消息: {}", text, e);
            return null;
        }

        if (chatMessage == null) {
            log.warn("无法解析消息: {}", text);
            return null;
        }

        Integer cmd = chatMessage.getCmd();
        if (cmd == null) {
            log.warn("消息缺少cmd字段，忽略消息: {}", text);
            return null;
        }

        try {
            switch (cmd) {
                case 1:
                    // 登录命令，绑定用户并加入默认群组
                    ChatService.bindUser(chatMessage.getFrom(), channelContext);
                    break;
                case 2:
                    // 私聊消息，保存离线消息后转发
                    ChatService.saveOfflineMessage(chatMessage);
                    ChatService.sendPrivateMsg(chatMessage, channelContext);
                    break;
                case 3:
                    // 群聊消息，保存离线消息后转发
                    ChatService.saveOfflineMessage(chatMessage);
                    ChatService.sendGroupMsg(chatMessage, channelContext);
                    break;
                default:
                    log.warn("未知cmd命令: {}", cmd);
            }
        } catch (Exception e) {
            log.error("处理消息异常: {}", text, e);
        }

        return null;
    }
}