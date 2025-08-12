
let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;

let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = 'socket_message_queue';

// 存放消息状态回调，key为msgId，value为回调函数
const msgStatusCallbacks = new Map();

// 存放消息ACK超时定时器，key为msgId，value为定时器ID
const ackTimers = new Map();

const CONNECT_STATUS = {
    DISCONNECTED: 0,
    CONNECTING: 1,
    CONNECTED: 2,
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function persistQueue() {
    try {
        uni.setStorageSync(QUEUE_KEY, messageQueue);
        console.log('[socket] 缓存队列已持久化，长度:', messageQueue.length);
    } catch (e) {
        console.error('[socket] persistQueue error', e);
    }
}

function loadQueueFromStorage() {
    try {
        const q = uni.getStorageSync(QUEUE_KEY);
        messageQueue = Array.isArray(q) ? q : [];
        console.log('[socket] 从本地缓存恢复队列，长度:', messageQueue.length);
    } catch (e) {
        messageQueue = [];
    }
}

export function connectSocket(userId, onMessage) {
    if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
        console.warn('WebSocket 已经连接或正在连接中，跳过重复连接');
        return;
    }

    currentUserId = userId;
    connectStatus = CONNECT_STATUS.CONNECTING;
    console.log('[socket] 准备连接 WebSocket，用户ID:', userId);

    const wsUrl = `ws://192.168.2.5:9326?name=${encodeURIComponent(userId)}`; // 请根据实际IP端口替换
    socketTask = uni.connectSocket({
        url: wsUrl,
        success() {
            console.log('WebSocket 连接请行求发起');
        },
        fail(err) {
            console.error('WebSocket 连接请求失败', err);
            attemptReconnect(onMessage);
        },
    });

    socketTask.onOpen(() => {
        console.log('📡 WebSocket 已打开');
        connectStatus = CONNECT_STATUS.CONNECTED;
        reconnectCount = 0;

        // 发送登录消息
        const loginData = {
            cmd: 1,
            from: currentUserId,
        };
        socketTask.send({ data: JSON.stringify(loginData) });

        loadQueueFromStorage();
        flushQueue();
    });

    socketTask.onMessage((res) => {
        const dataStr = res.data;
        if (!dataStr || dataStr === 'null' || dataStr === 'undefined') {
            console.warn('收到无效消息:', dataStr);
            return;
        }
        if (dataStr.trim().startsWith('{') || dataStr.trim().startsWith('[')) {
            try {
                const data = JSON.parse(dataStr);

                // 处理ACK消息，cmd == -1 表示后端确认收到消息
                if (data.cmd === -1 && data.msgId) {
                    const cb = msgStatusCallbacks.get(data.msgId);
                    if (cb) {
                        cb('success'); // 标记成功
                        console.log('安全握手成功～')
                        msgStatusCallbacks.delete(data.msgId);
                    }
                    // 清理对应ACK超时定时器
                    if (ackTimers.has(data.msgId)) {
                        clearTimeout(ackTimers.get(data.msgId));
                        ackTimers.delete(data.msgId);
                    }
                    return; // 不转发ACK消息给业务处理，防止重复显示
                }

                // 非ACK普通消息回调
                onMessage && onMessage(data);
            } catch (e) {
                console.error('消息解析错误', e, dataStr);
            }
        } else {
            console.log('收到非 JSON 消息:', dataStr);
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
    if (reconnectCount >= MAX_RECONNECT) {
        console.warn('重连次数达到上限，停止重连');
        return;
    }
    if (reconnectTimer) return;

    reconnectCount++;
    const delay = Math.min(30000, 5000 * Math.pow(2, reconnectCount - 1));
    console.log(`第${reconnectCount}次重连，${delay}ms后尝试`);

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSocket(currentUserId, onMessage);
    }, delay);
}

function flushQueue() {
    if (!messageQueue.length) {
        console.log('[socket] flushQueue：无缓存消息需要发送');
        return;
    }
    console.log('[socket] flushQueue start, 消息数量:', messageQueue.length);

    const sendNext = () => {
        if (!messageQueue.length) {
            console.log('[socket] flushQueue 完成，缓存队列清空');
            persistQueue();
            return;
        }
        const item = messageQueue[0];
        try {
            socketTask.send({
                data: JSON.stringify(item),
                success() {
                    console.log('[socket] flushQueue 发送成功:', item);
                    if (item.msgId && msgStatusCallbacks.has(item.msgId)) {
                        msgStatusCallbacks.get(item.msgId)('sending');
                        // 设置ACK超时定时器
                        if (ackTimers.has(item.msgId)) {
                            clearTimeout(ackTimers.get(item.msgId));
                        }
                        const timerId = setTimeout(() => {
                            const cb = msgStatusCallbacks.get(item.msgId);
                            if (cb) {
                                cb('failed'); // 超时未收到ACK标记失败
                                msgStatusCallbacks.delete(item.msgId);
                            }
                            ackTimers.delete(item.msgId);
                        }, 5000);
                        ackTimers.set(item.msgId, timerId);
                    }
                    messageQueue.shift();
                    persistQueue();
                    setTimeout(sendNext, 50);
                },
                fail(err) {
                    console.warn('[socket] flush fail', err);
                    if (item.msgId && msgStatusCallbacks.has(item.msgId)) {
                        msgStatusCallbacks.get(item.msgId)('failed');
                    }
                },
            });
        } catch (e) {
            console.error('[socket] flush exception', e);
        }
    };
    sendNext();
}

function sendData(data, onStatusChange) {
    if (!data.msgId) {
        data.msgId = generateUUID();
    }
    if (onStatusChange && typeof onStatusChange === 'function') {
        msgStatusCallbacks.set(data.msgId, onStatusChange);
    }
    if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
        console.warn('WebSocket 未连接，消息加入队列缓存', data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('failed');
        return;
    }
    try {
        socketTask.send({
            data: JSON.stringify(data),
            success() {
                console.log('[socket] 消息发送成功', data);
                if (onStatusChange) onStatusChange('sending');
                // 设置ACK超时定时器
                if (ackTimers.has(data.msgId)) {
                    clearTimeout(ackTimers.get(data.msgId));
                }
                const timerId = setTimeout(() => {
                    const cb = msgStatusCallbacks.get(data.msgId);
                    if (cb) {
                        cb('failed'); // 超时未收到ACK标记失败
                        msgStatusCallbacks.delete(data.msgId);
                    }
                    ackTimers.delete(data.msgId);
                }, 5000);
                ackTimers.set(data.msgId, timerId);
            },
            fail(err) {
                console.error('发送消息失败，加入缓存', err, data);
                messageQueue.push(data);
                persistQueue();
                if (onStatusChange) onStatusChange('failed');
            },
        });
    } catch (e) {
        console.error('发送消息异常，消息加入缓存', e, data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('failed');
    }
}

export function sendMsg(toUserId, msg, fromUserId, onStatusChange) {
    const data = {
        cmd: 2,
        type: 'private',
        from: fromUserId,
        to: toUserId,
        message: msg,
        timestamp: Date.now(),
    };
    sendData(data, onStatusChange);
}

export function sendGroupMsg(groupId, msg, fromUserId, onStatusChange) {
    const data = {
        cmd: 3,
        type: 'group',
        from: fromUserId,
        to: groupId,
        message: msg,
        timestamp: Date.now(),
    };
    sendData(data, onStatusChange);
}

export function retrySend(msgObj, onStatusChange) {
    if (!msgObj.msgId) {
        console.warn('retrySend 缺少 msgId，无法重发');
        return;
    }
    console.log('[socket] retrySend 重发消息', msgObj);
    sendData(msgObj, onStatusChange);
}

export function closeSocket() {
    if (socketTask) {
        console.log('[socket] 主动关闭 WebSocket 连接');
        socketTask.close();
        socketTask = null;
        connectStatus = CONNECT_STATUS.DISCONNECTED;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        reconnectCount = 0;
    }
}

export function isConnected() {
    return connectStatus === CONNECT_STATUS.CONNECTED;
}