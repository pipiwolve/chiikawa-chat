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

/**
 * ChatWsHandler 是 t-io WebSocket 服务端的核心消息处理器。
 * 它负责处理 WebSocket 握手、用户登录绑定、以及接收和分发私聊和群聊消息的业务逻辑。
 * 该类通过实现 IWsMsgHandler 接口，接管 WebSocket 消息的生命周期管理。
 */
public class ChatWsHandler implements IWsMsgHandler {
    private static Logger log = LoggerFactory.getLogger(ChatWsHandler.class);
    public static final ChatWsHandler me = new ChatWsHandler();

    private ChatWsHandler() {
    }

    /**
     * WebSocket 握手阶段调用的方法。
     * 业务可在此方法中获取客户端请求参数（如用户名）、Cookie 等信息。
     * 该方法完成用户身份绑定，确保后续消息能够识别用户身份。
     *
     * @param request        HTTP 请求对象，包含客户端请求信息
     * @param httpResponse   HTTP 响应对象，握手响应
     * @param channelContext 当前连接的上下文对象
     * @return 返回修改后的 HttpResponse 对象
     * @throws Exception 可能抛出异常
     */
    @Override
    public HttpResponse handshake(HttpRequest request, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        // 获取客户端 IP 地址，便于日志记录和安全审计
        String clientIp = request.getClientIp();

        // 从请求参数中获取用户名，客户端应通过 name 参数传递用户名
        String username = request.getParam("name");

        // 如果用户名为空或仅包含空白字符，则生成一个随机 UUID 作为用户名，保证每个连接有唯一标识
        if (username == null || username.trim().isEmpty()) {
            username = UUID.randomUUID().toString();
            log.info("未传入用户名参数 name，生成随机用户名: {}，客户端IP: {}", username, clientIp);
        }

        // 将当前 ChannelContext 绑定到该用户名，实现用户身份识别功能
        // 绑定后，后续消息处理可通过 channelContext.userid 获取用户名
        Tio.bindUser(channelContext, username);

        // 记录握手日志，方便追踪用户连接来源
        log.info("用户 [{}] 从 [{}] 发起 WebSocket 握手", username, clientIp);

        // 返回握手响应，允许连接建立
        return httpResponse;
    }

    /**
     * 握手完成后调用的方法。
     * 该方法主要负责将用户绑定到默认群组，并向群组内广播用户上线通知。
     *
     * @param httpRequest    握手请求对象
     * @param httpResponse   握手响应对象
     * @param channelContext 当前连接上下文
     * @throws Exception 可能抛出异常
     */
    @Override
    public void onAfterHandshaked(HttpRequest httpRequest, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        // 将当前用户绑定到默认的聊天群组中，方便群发消息
        // ChatConst.GROUP_ID 是预定义的群组标识
        Tio.bindGroup(channelContext, ChatConst.GROUP_ID);

        // 获取当前在线用户总数，用于通知新用户上线时显示在线人数
        int count = Tio.getAll(channelContext.tioConfig).getObj().size();

        // 构造群组消息，通知群内其他成员有新用户加入
        // 这里消息格式是简单的 JSON 字符串，from 字段固定为 admin 代表系统消息
        String msg = "{\"from\" : \"admin\", \"text\" : \"" + channelContext.userid + " 进来了，共【" + count + "】人在线\"}";

        // 将字符串消息封装为 WebSocket 文本响应对象，指定字符集编码
        WsResponse wsResponse = WsResponse.fromText(msg, ChatServerConfig.CHARSET);

        // 群发消息给所有绑定该群组的客户端，实现在线通知广播
        Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);
    }

    /**
     * 处理客户端发送的二进制消息（binaryType = arraybuffer）。
     * 目前未实现具体业务逻辑，返回 null。
     *
     * @param wsRequest      WebSocket 请求对象
     * @param bytes          客户端发送的字节数组
     * @param channelContext 当前连接上下文
     * @return 返回 null，表示不处理该消息
     * @throws Exception 可能抛出异常
     */
    @Override
    public Object onBytes(WsRequest wsRequest, byte[] bytes, ChannelContext channelContext) throws Exception {
        // 目前不支持二进制消息，直接忽略
        return null;
    }

    /**
     * 当客户端主动发送关闭连接标志时调用该方法。
     * 负责清理连接资源，移除 ChannelContext。
     *
     * @param wsRequest      WebSocket 请求对象
     * @param bytes          关闭标志的字节数据
     * @param channelContext 当前连接上下文
     * @return 返回 null
     * @throws Exception 可能抛出异常
     */
    @Override
    public Object onClose(WsRequest wsRequest, byte[] bytes, ChannelContext channelContext) throws Exception {
        // 移除当前连接，释放资源，参数为关闭原因描述
        Tio.remove(channelContext, "receive close flag");
        return null;
    }

    /**
     * 处理客户端发送的文本消息（binaryType = blob）。
     * 支持私聊和群聊两种消息类型，消息格式为 JSON，使用 ChatMessage 模型解析。
     *
     * @param wsRequest      WebSocket 请求对象
     * @param text           客户端发送的文本消息
     * @param channelContext 当前连接上下文
     * @return 返回 null
     * @throws Exception 可能抛出异常
     */
    @Override
    public Object onText(WsRequest wsRequest, String text, ChannelContext channelContext) throws Exception {
        // 如果开启了调试日志，打印收到的客户端消息内容
        if (log.isDebugEnabled()) {
            log.debug("收到客户端消息: {}", text);
        }

        // 使用 JsonUtil 工具将 JSON 字符串解析为 ChatMessage 对象
        // ChatMessage 包含消息的基本字段，如 from、to、type、cmd、message 等
            ChatMessage chatMessage = JsonUtil.fromJson(text, ChatMessage.class);

        // 如果解析失败，记录警告日志并忽略该消息
        if (chatMessage == null) {
            log.warn("无法解析消息: {}", text);
            return null;
        }



        // 判断消息中的 cmd 字段，支持特定命令处理
        Integer cmd = chatMessage.getCmd();
        if (cmd != null) {
            if (cmd == 1) {
                // cmd=1 表示登录命令，客户端请求绑定用户ID
                String userId = chatMessage.getFrom();
                if (userId != null && !userId.trim().isEmpty()) {
                    // 绑定当前连接到指定用户ID，方便后续消息路由
                    Tio.bindUser(channelContext, userId);

                    // 记录成功绑定日志
                    log.info("用户 [{}] 登录绑定成功", userId);

                    // 构造登录成功的系统消息，通知客户端登录成功
                    String loginMsg = "{\"from\":\"admin\",\"text\":\"登录成功，用户ID：" + userId + "\"}";

                    // 封装为 WebSocket 响应对象
                    WsResponse loginResponse = WsResponse.fromText(loginMsg, ChatServerConfig.CHARSET);

                    // 发送登录成功消息给当前客户端
                    Tio.send(channelContext, loginResponse);
                }
                // 处理完登录命令后返回，不再继续处理该消息
                return null;
            }
        }

        // 设置消息发送者为当前连接绑定的用户ID，保证消息来源准确
        chatMessage.setFrom(channelContext.userid);

        // 设置消息发送时间戳，便于客户端展示或排序
        chatMessage.setTimestamp(System.currentTimeMillis());

        // 将 ChatMessage 重新编码为简单 JSON 字符串，包含发送者和消息内容
        String json = "{\"from\":\"" + chatMessage.getFrom() + "\",\"text\":\"" + chatMessage.getMessage() + "\"}";

        // 封装为 WebSocket 文本响应对象，准备发送
        WsResponse wsResponse = WsResponse.fromText(json, ChatServerConfig.CHARSET);

        // 根据消息类型判断发送方式，支持私聊和群聊
        if ("private".equals(chatMessage.getType())) {
            // 私聊消息，发送给指定的目标用户
            boolean sent = Tio.sendToUser(channelContext.tioConfig, chatMessage.getTo(), wsResponse);

            // 如果发送失败，说明目标用户不在线，记录警告日志
            if (!sent) {
                log.warn("私聊消息发送失败，目标用户 [{}] 不在线", chatMessage.getTo());
            }
        } else if ("group".equals(chatMessage.getType())) {
            // 群聊消息，群发给所有绑定该群组的用户
            Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);
        } else {
            // 未知消息类型，记录警告日志
            log.warn("未知消息类型: {}", chatMessage.getType());
        }

        return null;
    }
}
