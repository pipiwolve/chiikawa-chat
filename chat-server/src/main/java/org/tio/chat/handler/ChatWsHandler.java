package org.tio.chat.handler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.constant.ChatConst;
import org.tio.chat.model.*;
import org.tio.chat.service.*;
import org.tio.chat.util.JsonUtil;
import org.tio.core.ChannelContext;
import org.tio.core.Tio;
import org.tio.http.common.HttpRequest;
import org.tio.http.common.HttpResponse;
import org.tio.utils.lock.SetWithLock;
import org.tio.websocket.common.WsRequest;
import org.tio.websocket.common.WsResponse;
import org.tio.websocket.server.handler.IWsMsgHandler;

import java.util.*;
import java.util.stream.Collectors;


/**
 * ChatWsHandler 是 t-io WebSocket 服务端的核心消息处理器。
 * 负责 WebSocket 握手、连接管理及消息分发，业务逻辑委托给 ChatService。
 */
public class ChatWsHandler implements IWsMsgHandler {
    private static final Logger log = LoggerFactory.getLogger(ChatWsHandler.class);
    public static final ChatWsHandler me = new ChatWsHandler();

    // 统一字符编码，保证消息编码一致性
    private static final String CHARSET = "UTF-8";

    private ChatWsHandler() {
    }

    /**
     * WebSocket 握手阶段，绑定用户ID，确保连接和用户绑定。
     *
     * @param request        HTTP请求
     * @param httpResponse   HTTP响应
     * @param channelContext 连接上下文
     * @return HttpResponse 返回握手响应或null拒绝握手
     * @throws Exception
     */
    @Override
    public HttpResponse handshake(HttpRequest request, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        String clientIp = request.getClientIp();
        log.info("新连接来自 [{}]", clientIp);

        return httpResponse;
    }

    /**
     * 握手完成后，加入默认群组并广播上线通知，使用统一的消息格式。
     *
     * @param httpRequest    HTTP请求
     * @param httpResponse   HTTP响应
     * @param channelContext 连接上下文
     * @throws Exception
     */
    @Override
    public void onAfterHandshaked(HttpRequest httpRequest, HttpResponse httpResponse, ChannelContext channelContext) throws Exception {
        log.info("握手完成，等待用户发送登录消息后再绑定 userId 和群组");
    }


    /**
     * 核心的文本消息处理入口，调用 ChatService 处理业务逻辑。
     * 新增对消息唯一标识 msgId 的处理，保证消息唯一性和确认机制。
     *
     * @param wsRequest      WebSocket请求
     * @param text           文本消息内容
     * @param channelContext 连接上下文
     * @return Object 返回null表示不回复
     * @throws Exception
     */
    @Override
    public Object onText(WsRequest wsRequest, String text, ChannelContext channelContext) throws Exception {
        if (log.isDebugEnabled()) {
            log.debug("收到客户端消息: {}", text);
        }

        ChatMessage chatMessage = JsonUtil.fromJson(text, ChatMessage.class);

        Integer cmd = chatMessage.getCmd();
        if (cmd == null) {
            log.warn("消息缺少cmd字段，忽略消息: {}", text);
            return null;
        }

        // 如果消息没有msgId，则生成唯一UUID，保证消息唯一性
        if (chatMessage.getMsgId() == null || chatMessage.getMsgId().trim().isEmpty()) {
            String newMsgId = UUID.randomUUID().toString();
            chatMessage.setMsgId(newMsgId);
        }

        try {
            switch (cmd) {
                case 2:
                    ChatService.sendPrivateMsg(chatMessage, channelContext);
                    break;
                case 3:
                    // 群聊消息转发
                    ChatService.sendGroupMsg(chatMessage, channelContext);
                    break;

                case 10: { // 注册
                    String userId = chatMessage.getFromUser();
                    String password = chatMessage.getContent(); // content 存密码
                    String nickname = chatMessage.getNickname();

                    boolean ok = ChatUserService.register(userId, password, nickname);

                    Map<String, Object> respMap = new HashMap<>();
                    respMap.put("cmd", 10);
                    respMap.put("result", ok ? "ok" : "fail");

                    WsResponse resp = WsResponse.fromText(JsonUtil.toJson(respMap), ChatServerConfig.CHARSET);
                    Tio.send(channelContext, resp);
                    break;
                }

                case 11: { // 登录
                    String userId = chatMessage.getFromUser();
                    String password = chatMessage.getContent();

                    ChatUser user = ChatUserService.login(userId, password);
                    Map<String, Object> result = new HashMap<>();

                    if (user != null) {
                        result.put("cmd", 11);
                        result.put("result", "ok");
                        result.put("nickname", user.getUserName());

                        handleUserLoginSuccess(user, userId, channelContext);
                    } else {
                        result.put("cmd", 11);
                        result.put("result", "fail");
                    }
                    WsResponse resp = WsResponse.fromText(JsonUtil.toJson(result), ChatServerConfig.CHARSET);
                    Tio.send(channelContext, resp);
                    break;
                }

                case 100: // 私聊已读回执
                    ChatService.processReadAck(chatMessage.getMsgIds(), chatMessage.getFromUser(), channelContext);
                    break;

                case 102: // 群聊已读游标更新
                    ChatGroupService.updateGroupReadCursor(chatMessage.getFromUser(), chatMessage.getGroupId(), chatMessage.getMsgId());
                    // 这里可以扩展：通知群组其他成员该用户已读到哪里
                    ChatGroupService.broadcastGroupCursor(chatMessage, channelContext);
                    break;

                // 历史信息加载
                case 103: {
                    List<ChatMessage> history = ChatGroupService.loadGroupHistory(chatMessage.getFromUser(), chatMessage.getGroupId(), chatMessage.getPageNum(), chatMessage.getPageSize());

                    WsResponse resp = WsResponse.fromText(JsonUtil.toJson(history), ChatServerConfig.CHARSET);
                    Tio.sendToUser(channelContext.tioConfig, chatMessage.getFromUser(), resp);
                    break;
                }

                // 获取最近会话
                case 200: {
                    List<ChatSession> sessions = ChatSessionService.getRecentSessions(chatMessage.getFromUser());
                    Map<String, Object> resp200 = new HashMap<>();
                    resp200.put("cmd", 200);
                    resp200.put("sessions", sessions);
                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp200), CHARSET));
                    break;
                }

                //加入群组
                case 201: {
                    boolean ok = ChatGroupService.joinGroup(chatMessage.getGroupId(), chatMessage.getFromUser(), channelContext);
                    Map<String,Object> resp201 = new HashMap<>();
                    resp201.put("cmd", 201);
                    resp201.put("result", ok ? "ok" : "fail");
                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp201), CHARSET));
                    break;
                }

                // 创建群聊
                case 203: {      // 鉴权：必须已登录（T-io 已绑定 userId）
                    if (channelContext.userid == null || !channelContext.userid.equals(chatMessage.getFromUser())) {
                        Map<String,Object> err = new HashMap<>();
                        err.put("cmd", 203);
                        err.put("result", "fail");
                        err.put("reason", "unauthorized");
                        Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(err), ChatServerConfig.CHARSET));
                        break;
                    }

                    String ownerId = chatMessage.getFromUser();
                    String groupName = chatMessage.getContent();
                    List<String> members = chatMessage.getMsgIds(); // 复用 msgIds

                    ChatGroup group = ChatGroupService.createGroup(ownerId, groupName, members, channelContext);

                    // 回执给创建者
                    Map<String, Object> ok = new HashMap<>();
                    ok.put("cmd", 203);
                    ok.put("result", "ok");
                    ok.put("groupId", group.getGroupId());
                    ok.put("groupName", group.getGroupName());
                    ok.put("creatTime", group.getCreatTime());
                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(ok), ChatServerConfig.CHARSET));

                    // 可选：通知其他初始成员（在线才会收到）
                    if (members != null) {
                        for (String uid : new LinkedHashSet<>(members)) {
                            if (uid == null || uid.equals(ownerId)) continue;
                            SetWithLock<ChannelContext> mCtx = Tio.getChannelContextsByUserid(channelContext.tioConfig, uid);
                            if (mCtx != null) {
                                Map<String,Object> notify = new HashMap<>();
                                notify.put("cmd", 204); // 204 = 被拉入新群通知
                                notify.put("groupId", group.getGroupId());
                                notify.put("groupName", group.getGroupName());
                                notify.put("inviter", ownerId);
                                Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(notify), ChatServerConfig.CHARSET));
                            }
                        }
                    }
                    break;
                }

                // 获取群聊列表
                case 212: {
                    String userId = chatMessage.getFromUser();
                    List<ChatGroup> groups = ChatGroupService.getGroupsByUser(userId);

                    // 也可以映射成轻量 DTO，这里直接回 Group 基础字段
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("cmd", 212);
                    resp.put("groups", groups.stream().map(g -> {
                        GroupDTO groupDTO = new GroupDTO();
                        groupDTO.setGroupId(g.getGroupId());
                        groupDTO.setGroupName(g.getGroupName());
                        groupDTO.setAvatar(g.getAvatar());
                        return groupDTO;
                    }).collect(Collectors.toList()));

                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp), CHARSET));
                    break;
                }

                // 发送好友申请
                case 202: {
                    String from = chatMessage.getFromUser();
                    String to = chatMessage.getToUser();

                    if (from == null || !from.equals(channelContext.userid)) {
                        sendFail(channelContext, 202, "unauthorized");
                        break;
                    }

                    boolean inserted = FriendRequestService.createRequest(from, to);

                    Map<String, Object> resp = new HashMap<>();
                    resp.put("cmd", 202);
                    resp.put("result", inserted ? "pending" : "fail");
                    if (!inserted) resp.put("reason", "already_requested_or_exists");
                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp), CHARSET));

                    if (inserted) {
                        // 通知目标用户（如果在线）
                        Map<String,Object> notify = new HashMap<>();
                        notify.put("cmd", 205);  // 好友申请通知
                        notify.put("fromUser", from);
                        notify.put("message", from + " 想加你为好友");
                        notify.put("timestamp", System.currentTimeMillis());

                        Tio.sendToUser(channelContext.tioConfig, to,
                                WsResponse.fromText(JsonUtil.toJson(notify), CHARSET));
                    }
                    break;
                }

                // 处理好友申请
                case 206: {
                    String from = chatMessage.getFromUser(); // 发起 accept/reject 的用户
                    String requester = chatMessage.getRequester(); // 谁申请的
                    String action = chatMessage.getAction();   // "accept" or "reject"

                    if (from == null || !from.equals(channelContext.userid)) {
                        sendFail(channelContext, 206, "unauthorized");
                        break;
                    }

                    boolean ok = FriendRequestService.handleRequest(requester, from, action);

                    Map<String,Object> resp = new HashMap<>();
                    resp.put("cmd", 206);
                    resp.put("result", ok ? "ok" : "fail");
                    resp.put("action", action);
                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp), CHARSET));

                    if (ok && "accept".equals(action)) {
                        // 插入 chat_user_friend 双向关系
                        ChatUserService.addFriend(requester, from);
                        ChatUserService.addFriend(from, requester);

                        // 通知两端好友已建立
                        Map<String,Object> notify = new HashMap<>();
                        notify.put("cmd", 207);
                        notify.put("result", "friend_added");
                        notify.put("userId", requester);
                        notify.put("friendId", from);

                        Tio.sendToUser(channelContext.tioConfig, requester,
                                WsResponse.fromText(JsonUtil.toJson(notify), CHARSET));
                        Tio.sendToUser(channelContext.tioConfig, from,
                                WsResponse.fromText(JsonUtil.toJson(notify), CHARSET));
                    }
                    break;
                }

                // 获取好友列表
                case 208: {
                    if (channelContext.userid == null || !channelContext.userid.equals(chatMessage.getFromUser())) {
                        sendFail(channelContext, 208, "unauthorized");
                        break;
                    }

                    List<FriendDTO> friends = ChatUserService.getFriends(chatMessage.getFromUser()).stream()
                            .map(u -> {
                                FriendDTO f = new FriendDTO();
                                f.setUserId(u.getUserId());
                                f.setUsername(u.getUserName());
                                f.setAvatar(u.getAvatar());
                                return f;
                            }).collect(Collectors.toList());


                    Map<String, Object> resp = new HashMap<>();
                    resp.put("cmd", 208);
                    resp.put("friends", friends);

                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp), ChatServerConfig.CHARSET));
                    break;
                }

                // 获取待处理好友申请
                case 209: {
                    List<FriendRequest> requests = FriendRequestService.getPendingRequests(chatMessage.getFromUser());
                    Map<String, Object> resp209 = new HashMap<>();
                    resp209.put("cmd", 209);
                    resp209.put("requests", requests);
                    Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp209), CHARSET));
                    break;
                }
            }
    } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return null;
    }

    /**
     * 登录成功后，绑定用户、群组，并推送离线消息与已读回执
     */
    private void handleUserLoginSuccess(ChatUser user, String userId, ChannelContext channelContext) {
        // 1. 绑定 userId
        Tio.bindUser(channelContext, userId);
        log.info("用户 [{}] 登录成功，绑定到连接", userId);

        // 2. 绑定群组
        List<String> groupIds = ChatGroupService.getUserGroupIds(userId);
        if (groupIds != null) {
            for (String gid : groupIds) {
                Tio.bindGroup(channelContext, gid);
                log.info("用户 [{}] 加入群组 [{}]", userId, gid);
            }
        }

        // 3. 系统消息：广播上线
        int count = Tio.getAll(channelContext.tioConfig).getObj().size();
        ChatMessage sysMsg = new ChatMessage();
        sysMsg.setFromUser("系统");
        sysMsg.setContent(user.getUserName() + " 上线了，共【" + count + "】人在线");
        Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID,
                WsResponse.fromText(JsonUtil.toJson(sysMsg), ChatServerConfig.CHARSET));

        // 4. 推送离线消息
        List<ChatMessage> offlineMessages = ChatService.getOfflineMessages(userId);
        if (offlineMessages != null && !offlineMessages.isEmpty()) {
            for (ChatMessage offlineMsg : offlineMessages) {
                Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(offlineMsg), ChatServerConfig.CHARSET));
            }
            ChatService.markOfflineMessagesDelivered(userId);
        }

        // 5. 推送离线已读回执
        List<ChatMessage> receipts = ChatService.getOfflineReadReceipts(userId);
        if (receipts != null && !receipts.isEmpty()) {
            for (ChatMessage receipt : receipts) {
                Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(receipt), ChatServerConfig.CHARSET));
            }
            ChatService.clearOfflineReadReceipts(userId);
        }
    }


    /**
     * 发送失败条件下回执
     * @param channelContext
     * @param cmd
     * @param reason
     */
    private void sendFail(ChannelContext channelContext, int cmd, String reason) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("cmd", cmd);
        resp.put("result", "fail");
        resp.put("reason", reason);
        Tio.send(channelContext, WsResponse.fromText(JsonUtil.toJson(resp), ChatServerConfig.CHARSET));
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

        // 获取当前在线人数，减去当前关闭的连接
        int count = Tio.getAll(channelContext.tioConfig).getObj().size() - 1;

        // 构造下线消息
        ChatMessage sysMsg = new ChatMessage();
        sysMsg.setFromUser("屁");
        sysMsg.setContent(channelContext.userid + " 离开了，现在共有【" + count + "】人在线");
        String jsonMsg = JsonUtil.toJson(sysMsg);

        // 发送给默认群组，通知其他人
        WsResponse wsResponse = WsResponse.fromText(jsonMsg, CHARSET);
        Tio.sendToGroup(channelContext.tioConfig, ChatConst.GROUP_ID, wsResponse);

        return null;
    }

}

