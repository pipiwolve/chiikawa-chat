let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;

let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = 'socket_message_queue';

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

const CONNECT_STATUS = {
    DISCONNECTED: 0,
    CONNECTING: 1,
    CONNECTED: 2,
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;

export function connectSocket(userId, onMessage) {
    if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
        console.warn('WebSocket 已经连接或正在连接中，跳过重复连接');
        return;
    }

    currentUserId = userId;
    connectStatus = CONNECT_STATUS.CONNECTING;
    console.log('[socket] 准备连接 WebSocket，用户ID:', userId);

    const wsUrl = `ws://192.168.110.238:9326?name=${encodeURIComponent(userId)}`; // 替换成你的局域网IP和端口
    socketTask = uni.connectSocket({
        url: wsUrl,
        success() {
            console.log('WebSocket 连接请求发起');
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

        const loginData = {
            cmd: 1,
            from: currentUserId,
        };
        socketTask.send({ data: JSON.stringify(loginData) });

        loadQueueFromStorage();
        flushQueue();
    });

    //接受后端传来的wsresponse
    socketTask.onMessage((res) => {
        const dataStr = res.data;
        if (!dataStr || dataStr === 'null' || dataStr === 'undefined') {
            console.warn('收到无效消息:', dataStr);
            return;
        }
        // 判断是否是 JSON 格式
        if (dataStr.trim().startsWith('{') || dataStr.trim().startsWith('[')) {
            try {
                const data = JSON.parse(dataStr);
                onMessage && onMessage(data);
            } catch (e) {
                console.error('消息解析错误', e, dataStr);
            }
        } else {
            // 非 JSON，视为普通文本消息，可根据业务需求处理
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

// 改进后的重连策略，首个重连延时3秒，指数增长，最长30秒
function attemptReconnect(onMessage) {
    if (reconnectCount >= MAX_RECONNECT) {
        console.warn('重连次数达到上限，停止重连');
        return;
    }
    if (reconnectTimer) return; // 已有重连任务

    reconnectCount++;
    const delay = Math.min(30000, 5000 * Math.pow(2, reconnectCount - 1)); // 3秒起步
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
                    messageQueue.shift();
                    persistQueue();
                    setTimeout(sendNext, 50);
                },
                fail(err) {
                    console.warn('[socket] flush fail', err);
                    // 不移除消息，等待下一次重发
                },
            });
        } catch (e) {
            console.error('[socket] flush exception', e);
            // 异常时不移除，保持消息，等待下次重发
        }
    };
    sendNext();
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
    console.log('[socket] sendMsg 调用，消息:', data);
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
    console.log('[socket] sendGroupMsg 调用，消息:', data);
    sendData(data, onStatusChange);
}

function sendData(data, onStatusChange) {
    if (connectStatus !== CONNECT_STATUS.CONNECTED) {
        console.warn('WebSocket 未连接，消息加入队列缓存', data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange) onStatusChange('failed');
        return;
    }
    if (!socketTask) {
        console.error('WebSocket 连接不存在，发送失败', data);
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
                if (onStatusChange) onStatusChange('success');
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