let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;
let onGroupHistory = null;
let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = 'socket_message_queue';
let onReadAck = null;
let cmdCallbacks = {}; // 存放 cmd -> 回调

const msgStatusCallbacks = new Map();
const CONNECT_STATUS = { DISCONNECTED: 0, CONNECTING: 1, CONNECTED: 2 };
let connectStatus = CONNECT_STATUS.DISCONNECTED;
let activeTarget = null;

export function connectSocket(userId, onMessage) {
    if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) return;

    currentUserId = userId;
    connectStatus = CONNECT_STATUS.CONNECTING;

    const wsUrl = `ws://192.168.110.238:9326`;

    try {
        socketTask = uni.connectSocket({
            url: wsUrl,
            success() { console.log('WebSocket 连接请求已发起'); },
            fail(err) { console.error('WebSocket 连接请求失败', err); attemptReconnect(onMessage); },
        });
    } catch (e) {
        console.error('WebSocket 连接异常', e);
        attemptReconnect(onMessage);
        return;
    }

    socketTask.onOpen(() => {
        console.log('📡 WebSocket 已打开');
        connectStatus = CONNECT_STATUS.CONNECTED;
        reconnectCount = 0;

        loadQueueFromStorage();
        flushQueue();
    });

    socketTask.onMessage((res) => {
        const dataStr = res.data;
        if (!dataStr || dataStr === 'null' || dataStr === 'undefined') return;

        try {
            const data = JSON.parse(dataStr);

            // 🔹 分发给已注册的 cmd 回调
            if (data.cmd && cmdCallbacks[data.cmd]) {
                cmdCallbacks[data.cmd](data);
                return;
            }

            // 已读回执 101
            if (data && typeof data === 'object' && data.cmd === 101 && data.msgIds && Array.isArray(data.msgIds)) {
                if (data.toUser === currentUserId) {
                    onReadAck && onReadAck(data.msgIds);
                }
                return;
            }

            // 批量群历史处理
            if (Array.isArray(data) && data.length && (data[0].cmd === 3 || data[0].cmd === 103)) {
                onGroupHistory && onGroupHistory(data);
                return;
            }

            // 其他消息交由页面处理
            onMessage && onMessage(data);
        } catch (e) {
            console.error('消息解析错误', e, dataStr);
        }
    });

    socketTask.onClose(() => {
        console.log('WebSocket 已关闭');
        connectStatus = CONNECT_STATUS.DISCONNECTED;
        attemptReconnect(onMessage);
    });

    socketTask.onError((err) => {
        console.error('WebSocket 错误', err);
        connectStatus = CONNECT_STATUS.DISCONNECTED;
        attemptReconnect(onMessage);
    });
}

function attemptReconnect(onMessage) {
    if (reconnectCount >= MAX_RECONNECT) return;
    if (reconnectTimer) return;

    reconnectCount++;
    const delay = Math.min(30000, 5000 * Math.pow(2, reconnectCount - 1));

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSocket(currentUserId, onMessage);
    }, delay);
}


function flushQueue() {
    if (!messageQueue.length) { persistQueue(); return; }

    const item = messageQueue[0];
    try {
        socketTask.send({
            data: JSON.stringify(item),
            success() {
                messageQueue.shift();
                persistQueue();
                setTimeout(flushQueue, 50);
            },
            fail(err) {
                console.warn('[socket] flushQueue 发送失败:', err);
            }
        });
    } catch (e) {
        console.error('[socket] flushQueue 异常:', e);
    }
}

function persistQueue() {
    try { uni.setStorageSync(QUEUE_KEY, messageQueue); }
    catch (e) { console.error('[socket] persistQueue error', e); }
}

function loadQueueFromStorage() {
    try {
        const q = uni.getStorageSync(QUEUE_KEY);
        messageQueue = Array.isArray(q) ? q : [];
    } catch (e) { console.error('[socket] loadQueueFromStorage error', e); messageQueue = []; }
}

function sendData(data, onStatusChange) {
    if (onStatusChange) msgStatusCallbacks.set(data.msgId, onStatusChange);
    if (onStatusChange) onStatusChange('sending');

    if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('sending');
        return;
    }

    try {
        socketTask.send({
            data: JSON.stringify(data),
            success() {
                if (onStatusChange) onStatusChange('success');
                msgStatusCallbacks.delete(data.msgId);
            },
            fail(err) {
                messageQueue.push(data);
                persistQueue();
                if (onStatusChange) onStatusChange('failed');
                msgStatusCallbacks.delete(data.msgId);
            }
        });
    } catch (e) {
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('failed');
        msgStatusCallbacks.delete(data.msgId);
    }
}

// 🔹 新增通用业务消息发送函数
export function sendCmdMessage(cmd, payload = {}) {
    const data = { cmd, fromUser: currentUserId, ...payload };
    sendData(data);
}

// 注册好友功能回调
export function registerCmdHandler(cmd, callback) {
    cmdCallbacks[cmd] = callback;
}

export function unregisterCmdHandler(cmd) {
    delete cmdCallbacks[cmd]
}

// ===============================
// 登录注册
// ===============================

export function sendRegister(userId, password, nickname) {
    sendCmdMessage(10, { fromUser: userId, content: password, nickname });
}

export function sendLogin(userId, password) {
    sendCmdMessage(11, { fromUser: userId, content: password });
}

// ===============================
// 会话/好友/群聊相关封装
// ===============================

// 获取最近会话
export function fetchSessions(onResult) {
    registerCmdHandler(200, onResult);
    sendCmdMessage(200);
}

// 加入群聊
export function joinGroup(groupId, role = "member") {
    sendCmdMessage(201, { groupId, role });
}

// 添加好友（发起申请）
export function sendFriendRequest(toUser) {
    sendCmdMessage(202, { toUser });
}

// 创建群聊
export function createGroup(groupName, members) {
    sendCmdMessage(203, { content: groupName, msgIds: members });
}

// 🔹 获取好友申请列表
export function fetchFriendRequests(onResult) {
    registerCmdHandler(209, onResult)
    sendCmdMessage(209)
}

// 响应好友请求
export function respondFriendRequest(requester, fromUser , action) {
    sendCmdMessage(206, { requester, fromUser, action});
}

// 获取好友列表
export function fetchFriends(onResult) {
    registerCmdHandler(208, onResult);
    sendCmdMessage(208);
}

// 获取我的群聊列表（cmd=212）
export function fetchGroups(onResult) {
    registerCmdHandler(212, onResult);
    sendCmdMessage(212);
}



// 发送私聊消息
export function sendMsg(msg, onStatusChange) {
    const data = { cmd: 2, type: 'private', ...msg };
    try {
        sendData(data); // 发送到底层 WebSocket
        onStatusChange && onStatusChange('success'); // 成功回调
    } catch (e) {
        console.error('发送私聊失败', e);
        onStatusChange && onStatusChange('failed'); // 失败回调
    }
}

// 发送群聊消息
export function sendGroupMsg(msg, onStatusChange) {
    const data = { cmd: 3, type: 'group', ...msg };
    try {
        sendData(data);
        onStatusChange && onStatusChange('success');
    } catch (e) {
        console.error('发送群聊失败', e);
        onStatusChange && onStatusChange('failed');
    }
}

export function onPrivateMessage(callback) {
    registerCmdHandler(2, callback);
}

export function onGroupMessage(callback) {
    registerCmdHandler(3, callback);
}

export function sendReadAck(msgIds) {
    if (!Array.isArray(msgIds) || msgIds.length === 0) return;
    const ackData = { cmd: 100, fromUser: currentUserId, msgIds };
    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try { socketTask.send({ data: JSON.stringify(ackData) });
            console.log("发送已读回执:", ackData)}
        catch (e) { messageQueue.push(ackData); persistQueue(); }
    } else {
        messageQueue.push(ackData);
        persistQueue();
    }
}

export function fetchOfflinePrivateMessages(toUser, onResult) {
    if (!toUser) return;
    const payload = { toUser };
    const cmd = 211;
    registerCmdHandler(cmd, onResult);
    sendCmdMessage(cmd, payload);
}

export function sendGroupCursor(groupId, lastMsgId) {
    if (!groupId) return;
    const data = { cmd: 102, fromUser: currentUserId, groupId, msgId:lastMsgId, timestamp: Date.now() };
    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try { socketTask.send({ data: JSON.stringify(data) });}
        catch (e) { console.error('[socket] sendGroupCursor error', e); }
    }
}

export function sendGroupHistoryRequest(groupId, pageNum, pageSize) {
    if (!groupId) return;
    const data = { cmd: 103, fromUser: currentUserId, groupId, pageNum, pageSize, timestamp: Date.now() };
    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try { socketTask.send({ data: JSON.stringify(data) });}
        catch (e) { console.error('[socket] sendGroupHistoryRequest error', e); }
    }
}

export function setGroupHistoryHandler(callback) { onGroupHistory = callback; }
export function setReadAckHandler(callback) { onReadAck = callback; }
export function setActiveTarget(targetId) { activeTarget = targetId; }
export function closeSocket() {
    if (socketTask) {
        socketTask.close();
        socketTask = null;
        connectStatus = CONNECT_STATUS.DISCONNECTED;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        reconnectCount = 0;
    }
}
export function isConnected() { return connectStatus === CONNECT_STATUS.CONNECTED; }