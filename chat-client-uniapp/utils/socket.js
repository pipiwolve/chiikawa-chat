let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;
let onGroupHistory = null;  //批量群历史下发回调
let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = 'socket_message_queue';
let onReadAck = null;

const msgStatusCallbacks = new Map();

const CONNECT_STATUS = { DISCONNECTED: 0, CONNECTING: 1, CONNECTED: 2 };
let connectStatus = CONNECT_STATUS.DISCONNECTED;

let activeTarget = null;

export function connectSocket(userId, onMessage) {
    if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) return;

    currentUserId = userId;
    connectStatus = CONNECT_STATUS.CONNECTING;

    const wsUrl = `ws://172.20.10.18:9326?name=${encodeURIComponent(userId)}`;

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

        sendRaw({ cmd: 1, fromUser: currentUserId });

        loadQueueFromStorage();
        flushQueue();
    });

    socketTask.onMessage((res) => {
        const dataStr = res.data;
        if (!dataStr || dataStr === 'null' || dataStr === 'undefined') return;

        try {
            const data = JSON.parse(dataStr);

            // 已读回执 101
            if (data && typeof data === 'object' && data.cmd === 101 && data.msgIds && Array.isArray(data.msgIds)) {
                if (data.toUser === currentUserId) {
                    onReadAck && onReadAck(data.msgIds);
                }
                return;
            }

            // 批量群历史处理
            if (Array.isArray(data) && data.length && data[0].cmd === 3) {
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

function sendRaw(data) {
    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try { socketTask.send({ data: JSON.stringify(data) }); }
        catch (e) { console.error('[socket] 发送消息异常', e, data); }
    } else {
        console.warn('[socket] WebSocket未连接，无法发送消息:', data);
    }
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

export function sendMsg(msg, onStatusChange) {
    const data = { cmd: 2, type: 'private', ...msg};
    sendData(data, onStatusChange);
}

export function sendGroupMsg(msg, onStatusChange) {
    const data = { cmd: 3, type: 'group', ...msg};
    sendData(data, onStatusChange);
}

export function sendReadAck(msgIds) {
    if (!Array.isArray(msgIds) || msgIds.length === 0) return;
    const ackData = { cmd: 100,fromUser: currentUserId, msgIds };

    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try { socketTask.send({ data: JSON.stringify(ackData) }); }
        catch (e) { messageQueue.push(ackData); persistQueue(); }
    } else {
        messageQueue.push(ackData);
        persistQueue();
    }
}

export function sendGroupCursor(groupId, lastMsgId) {
    if (!groupId) return;
    const data = { cmd: 102, fromUser: currentUserId, groupId, lastMsgId, timestamp: Date.now() };
    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try { socketTask.send({ data: JSON.stringify(data) });}
        catch (e) { console.error('[socket] sendGroupCursor error', e); }
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
