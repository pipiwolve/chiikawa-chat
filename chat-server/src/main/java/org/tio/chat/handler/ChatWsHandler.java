package org.tio.chat.handler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.constant.ChatConst;
import org.tio.core.Tio;
import org.tio.core.ChannelContext;
import org.tio.http.common.HttpRequest;
import org.tio.http.common.HttpResponse;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.util.JsonUtil;
import org.tio.websocket.common.WsRequest;
import org.tio.websocket.common.WsResponse;
import org.tio.websocket.server.handler.IWsMsgHandler;
import java.util.UUID;


public class ChatWsHandler implements IWsMsgHandler {
    private static Logger log = LoggerFactory.getLogger(ChatWsHandler.class);
    public static final ChatWsHandler me = new ChatWsHandler();
    private ChatWsHandler() {
    }
    /**
     * 握手时走这个方法，业务可以在这里获取cookie，request参数等
     */
    @Override
    public HttpResponse handshake(HttpRequest request, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        String clientIp = request.getClientIp();
        String username = request.getParam("name");

        if (username == null || username.trim().isEmpty()) {
            username = UUID.randomUUID().toString();
            log.info("未传入用户名参数 name，生成随机用户名: {}，客户端IP: {}", username, clientIp);
        }

        Tio.bindUser(channelContext, username);
        log.info("用户 [{}] 从 [{}] 发起 WebSocket 握手", username, clientIp);

        return httpResponse;
    }
    /**
     * @param httpRequest
     * @param httpResponse
     * @param channelContext
     * @throws Exception
     */
    @Override
    public void onAfterHandshaked(HttpRequest httpRequest, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        // 绑定到群组
        Tio.bindGroup(channelContext, ChatConst.GROUP_ID);

        int count = Tio.getAll(channelContext.tioConfig).getObj().size();
        // 统一字段结构
        String msg = "{\"from\":\"admin\",\"text\":\"" + channelContext.userid + " 进来了，共【" + count + "】人在线\"}";

        WsResponse wsResponse = WsResponse.fromText(msg, ChatServerConfig.CHARSET);
        // 群发
        Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);
    }
    /**
     * 字节消息（binaryType = arraybuffer）过来后会走这个方法
     */
    @Override
    public Object onBytes(WsRequest wsRequest, byte[] bytes, ChannelContext channelContext) throws Exception {
        return null;
    }
    /**
     * 当客户端发close flag时，会走这个方法
     */
    @Override
    public Object onClose(WsRequest wsRequest, byte[] bytes, ChannelContext channelContext) throws Exception {
        Tio.remove(channelContext, "receive close flag");
        return null;
    }
    /*
     * 字符消息（binaryType = blob）过来后会走这个方法
     * 支持私聊和群聊消息，消息格式为JSON，使用ChatMessage模型和JsonUtil工具
     */
    @Override
    public Object onText(WsRequest wsRequest, String text, ChannelContext channelContext) throws Exception {
        if (log.isDebugEnabled()) {
            log.debug("收到客户端消息: {}", text);
        }

        // 解析消息
        ChatMessage chatMessage = JsonUtil.fromJson(text, ChatMessage.class);
        if (chatMessage == null) {
            log.warn("无法解析消息: {}", text);
            return null;
        }

        // 判断cmd字段
        Integer cmd = chatMessage.getCmd();
        if (cmd != null) {
            if (cmd == 1) {
                // 登录命令，只绑定用户ID并返回确认信息
                String userId = chatMessage.getFrom();
                if (userId != null && !userId.trim().isEmpty()) {
                    Tio.bindUser(channelContext, userId);
                    log.info("用户 [{}] 登录绑定成功", userId);
                    String loginMsg = "{\"from\":\"admin\",\"text\":\"登录成功，用户ID：" + userId + "\"}";
                    WsResponse loginResponse = WsResponse.fromText(loginMsg, ChatServerConfig.CHARSET);
                    Tio.send(channelContext, loginResponse);
                }
                return null;
            }
        }

        // 设置发送者信息
        chatMessage.setFrom(channelContext.userid);
        chatMessage.setTimestamp(System.currentTimeMillis());


        // 将消息编码为 JSON 文本
        String json = "{\"from\":\"" + chatMessage.getFrom() + "\",\"text\":\"" + chatMessage.getMessage() + "\"}";
        WsResponse wsResponse = WsResponse.fromText(json, ChatServerConfig.CHARSET);

        if ("private".equals(chatMessage.getType())) {
            // 私聊：单发
            boolean sent = Tio.sendToUser(channelContext.tioConfig, chatMessage.getTo(), wsResponse);
            if (!sent) {
                log.warn("私聊消息发送失败，目标用户 [{}] 不在线", chatMessage.getTo());
            }
        } else if ("group".equals(chatMessage.getType())) {
            // 群聊：群发
            Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);
        } else {
            log.warn("未知消息类型: {}", chatMessage.getType());
        }

        return null;
    }
}
