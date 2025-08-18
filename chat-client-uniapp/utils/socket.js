let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;

let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = 'socket_message_queue';
let onReadAck = null;

const msgStatusCallbacks = new Map();

const CONNECT_STATUS = {
    DISCONNECTED: 0,
    CONNECTING: 1,
    CONNECTED: 2,
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;

let activeTarget = null;

export function connectSocket(userId, onMessage) {
    if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
        console.warn('WebSocket 已经连接或正在连接中，跳过重复连接');
        return;
    }

    currentUserId = userId;
    connectStatus = CONNECT_STATUS.CONNECTING;
    console.log('[socket] 准备连接 WebSocket，用户ID:', userId);

    const wsUrl = `ws://192.168.110.238:9326?name=${encodeURIComponent(userId)}`;

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

        const loginData = { cmd: 1, from: currentUserId };
        sendRaw(loginData);

        loadQueueFromStorage();
        // flush queued messages (includes queued read-acks)
        flushQueue(onMessage);
    });

    socketTask.onMessage((res) => {
        const dataStr = res.data;
        if (!dataStr || dataStr === 'null' || dataStr === 'undefined') return;

        try {
            const data = JSON.parse(dataStr);

            // 已读回执 101：只交给 readAck 回调处理（发给发送方，readAck.to === senderId）
            if (data && typeof data === 'object' && data.cmd === 101 && data.msgIds && Array.isArray(data.msgIds)) {
                console.log('[socket] 收到已读回执 cmd=101，msgIds:', data.msgIds);
                if (data.to === currentUserId) {
                    onReadAck && onReadAck(data.msgIds);
                }
                return;
            }

            // 其他消息交由页面处理（例如 cmd=2/cmd=3 或批量离线消息数组）
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
        if (Array.isArray(q)) {
            messageQueue = q;
        } else {
            messageQueue = [];
        }
        // keep queued read-acks (cmd=100) so they will be flushed after reconnect
        console.log('[socket] 从本地缓存恢复队列，长度:', messageQueue.length);
    } catch (e) {
        console.error('[socket] 从本地缓存恢复队列异常', e);
        messageQueue = [];
    }
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

function sendRaw(data) {
    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try {
            socketTask.send({ data: JSON.stringify(data) });
        } catch (e) {
            console.error('[socket] 发送消息异常', e, data);
        }
    } else {
        console.warn('[socket] WebSocket未连接，无法发送消息:', data);
    }
}

// flushQueue 函数，发送缓存队列消息
const flushQueue = () => {
    if (!messageQueue.length) {
        console.log('[socket] flushQueue 完成，缓存队列为空')
        persistQueue()
        return
    }

    const item = messageQueue[0]

    try {
        socketTask.send({
            data: JSON.stringify(item),
            success() {
                console.log('[socket] flushQueue 发送成功:', item)

                // 移除已发送消息
                messageQueue.shift()
                persistQueue()

                // 如果这是最后一条离线消息且是接收方消息，发送已读回执
                if (messageQueue.length === 0 && item.from !== currentUserId) {
                    sendReadAck([item.msgId])
                }

                // 延迟发送下一条
                setTimeout(flushQueue, 50)
            },
            fail(err) {
                console.warn('[socket] flushQueue 发送失败:', err)
                // 可根据需要重试或标记状态
            }
        })
    } catch (e) {
        console.error('[socket] flushQueue 异常:', e)
    }
}

function sendData(data, onStatusChange) {
    // if (!data.msgId) {
    //     data.msgId = generateUUID();
    // }
    if (onStatusChange && typeof onStatusChange === 'function') {
        msgStatusCallbacks.set(data.msgId, onStatusChange);
    }
    if (onStatusChange) onStatusChange('sending');

    if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
        console.warn('WebSocket 未连接，消息加入队列缓存', data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('sending'); // queued / pending
        return;
    }

    try {
        socketTask.send({
            data: JSON.stringify(data),
            success() {
                console.log('[socket] 消息发送成功', data);
                if (onStatusChange) onStatusChange('success');
                msgStatusCallbacks.delete(data.msgId);
            },
            fail(err) {
                console.error('发送消息失败，加入缓存', err, data);
                messageQueue.push(data);
                persistQueue();
                if (onStatusChange) onStatusChange('failed');
                msgStatusCallbacks.delete(data.msgId);
            },
        });
    } catch (e) {
        console.error('发送消息异常，消息加入缓存', e, data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('failed');
        msgStatusCallbacks.delete(data.msgId);
    }
}

export function sendMsg(toUserId, msg, fromUserId, onStatusChange, msgId) {
    const data = {
        msgId: msgId,
        cmd: 2,
        type: 'private',
        from: fromUserId,
        to: toUserId,
        message: msg,
        timestamp: Date.now(),
    };
    sendData(data, onStatusChange);
}

export function sendGroupMsg(groupId, msg, fromUserId, onStatusChange, msgId) {
    const data = {
        msgId : msgId,
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

export function sendReadAck(msgIds) {
    if (!Array.isArray(msgIds) || msgIds.length === 0) {
        console.warn('[socket] sendReadAck 缺少 msgIds');
        return;
    }
    const ackData = {
        cmd: 100,
        msgIds: msgIds
    };

    if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
        try {
            socketTask.send({ data: JSON.stringify(ackData) });
            console.log('[socket] 发送已读确认:', ackData);
        } catch (e) {
            console.error('[socket] 发送已读确认失败，改为入队列', e);
            messageQueue.push(ackData);
            persistQueue();
        }
    } else {
        // not connected: enqueue for later flush
        messageQueue.push(ackData);
        persistQueue();
        console.log('[socket] read-ack 已入队列，等待重连后发送', ackData);
    }
}

export function setReadAckHandler(callback) {
    onReadAck = callback;
}

export function setActiveTarget(targetId) {
    activeTarget = targetId;
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