"use strict";
const common_vendor = require("../common/vendor.js");
let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;
let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = "socket_message_queue";
let onReadAck = null;
const msgStatusCallbacks = /* @__PURE__ */ new Map();
const CONNECT_STATUS = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;
function connectSocket(userId, onMessage) {
  if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
    common_vendor.index.__f__("warn", "at utils/socket.js:24", "WebSocket 已经连接或正在连接中，跳过重复连接");
    return;
  }
  currentUserId = userId;
  connectStatus = CONNECT_STATUS.CONNECTING;
  common_vendor.index.__f__("log", "at utils/socket.js:30", "[socket] 准备连接 WebSocket，用户ID:", userId);
  const wsUrl = `ws://192.168.110.238:9326?name=${encodeURIComponent(userId)}`;
  try {
    socketTask = common_vendor.index.connectSocket({
      url: wsUrl,
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:37", "WebSocket 连接请求已发起");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:38", "WebSocket 连接请求失败", err);
        attemptReconnect(onMessage);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:41", "WebSocket 连接异常", e);
    attemptReconnect(onMessage);
    return;
  }
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:47", "📡 WebSocket 已打开");
    connectStatus = CONNECT_STATUS.CONNECTED;
    reconnectCount = 0;
    const loginData = { cmd: 1, from: currentUserId };
    sendRaw(loginData);
    loadQueueFromStorage();
    flushQueue();
  });
  socketTask.onMessage((res) => {
    const dataStr = res.data;
    if (!dataStr || dataStr === "null" || dataStr === "undefined")
      return;
    try {
      const data = JSON.parse(dataStr);
      if (data && typeof data === "object" && data.cmd === 101 && data.msgIds && Array.isArray(data.msgIds)) {
        common_vendor.index.__f__("log", "at utils/socket.js:68", "[socket] 收到已读回执 cmd=101，msgIds:", data.msgIds);
        if (data.to === currentUserId) {
          onReadAck && onReadAck(data.msgIds);
        }
        return;
      }
      onMessage && onMessage(data);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:78", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:83", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:89", "WebSocket 错误", err);
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
    common_vendor.index.__f__("log", "at utils/socket.js:111", "[socket] 缓存队列已持久化，长度:", messageQueue.length);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:113", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    if (Array.isArray(q)) {
      messageQueue = q;
    } else {
      messageQueue = [];
    }
    common_vendor.index.__f__("log", "at utils/socket.js:126", "[socket] 从本地缓存恢复队列，长度:", messageQueue.length);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:128", "[socket] 从本地缓存恢复队列异常", e);
    messageQueue = [];
  }
}
function attemptReconnect(onMessage) {
  if (reconnectCount >= MAX_RECONNECT) {
    common_vendor.index.__f__("warn", "at utils/socket.js:135", "重连次数达到上限，停止重连");
    return;
  }
  if (reconnectTimer)
    return;
  reconnectCount++;
  const delay = Math.min(3e4, 5e3 * Math.pow(2, reconnectCount - 1));
  common_vendor.index.__f__("log", "at utils/socket.js:142", `第${reconnectCount}次重连，${delay}ms后尝试`);
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
      common_vendor.index.__f__("error", "at utils/socket.js:155", "[socket] 发送消息异常", e, data);
    }
  } else {
    common_vendor.index.__f__("warn", "at utils/socket.js:158", "[socket] WebSocket未连接，无法发送消息:", data);
  }
}
const flushQueue = () => {
  if (!messageQueue.length) {
    common_vendor.index.__f__("log", "at utils/socket.js:165", "[socket] flushQueue 完成，缓存队列为空");
    persistQueue();
    return;
  }
  const item = messageQueue[0];
  try {
    socketTask.send({
      data: JSON.stringify(item),
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:176", "[socket] flushQueue 发送成功:", item);
        messageQueue.shift();
        persistQueue();
        if (messageQueue.length === 0 && item.from !== currentUserId) {
          sendReadAck([item.msgId]);
        }
        setTimeout(flushQueue, 50);
      },
      fail(err) {
        common_vendor.index.__f__("warn", "at utils/socket.js:191", "[socket] flushQueue 发送失败:", err);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:196", "[socket] flushQueue 异常:", e);
  }
};
function sendData(data, onStatusChange) {
  if (onStatusChange && typeof onStatusChange === "function") {
    msgStatusCallbacks.set(data.msgId, onStatusChange);
  }
  if (onStatusChange)
    onStatusChange("sending");
  if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
    common_vendor.index.__f__("warn", "at utils/socket.js:210", "WebSocket 未连接，消息加入队列缓存", data);
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("sending");
    return;
  }
  try {
    socketTask.send({
      data: JSON.stringify(data),
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:221", "[socket] 消息发送成功", data);
        if (onStatusChange)
          onStatusChange("success");
        msgStatusCallbacks.delete(data.msgId);
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:226", "发送消息失败，加入缓存", err, data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange)
          onStatusChange("failed");
        msgStatusCallbacks.delete(data.msgId);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:234", "发送消息异常，消息加入缓存", e, data);
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("failed");
    msgStatusCallbacks.delete(data.msgId);
  }
}
function sendMsg(toUserId, msg, fromUserId, onStatusChange, msgId) {
  const data = {
    msgId,
    cmd: 2,
    type: "private",
    from: fromUserId,
    to: toUserId,
    message: msg,
    timestamp: Date.now()
  };
  sendData(data, onStatusChange);
}
function sendGroupMsg(groupId, msg, fromUserId, onStatusChange, msgId) {
  const data = {
    msgId,
    cmd: 3,
    type: "group",
    from: fromUserId,
    to: groupId,
    message: msg,
    timestamp: Date.now()
  };
  sendData(data, onStatusChange);
}
function sendReadAck(msgIds) {
  if (!Array.isArray(msgIds) || msgIds.length === 0) {
    common_vendor.index.__f__("warn", "at utils/socket.js:279", "[socket] sendReadAck 缺少 msgIds");
    return;
  }
  const ackData = {
    cmd: 100,
    msgIds
  };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(ackData) });
      common_vendor.index.__f__("log", "at utils/socket.js:290", "[socket] 发送已读确认:", ackData);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:292", "[socket] 发送已读确认失败，改为入队列", e);
      messageQueue.push(ackData);
      persistQueue();
    }
  } else {
    messageQueue.push(ackData);
    persistQueue();
    common_vendor.index.__f__("log", "at utils/socket.js:300", "[socket] read-ack 已入队列，等待重连后发送", ackData);
  }
}
function setReadAckHandler(callback) {
  onReadAck = callback;
}
function closeSocket() {
  if (socketTask) {
    common_vendor.index.__f__("log", "at utils/socket.js:314", "[socket] 主动关闭 WebSocket 连接");
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
function isConnected() {
  return connectStatus === CONNECT_STATUS.CONNECTED;
}
exports.closeSocket = closeSocket;
exports.connectSocket = connectSocket;
exports.isConnected = isConnected;
exports.sendGroupMsg = sendGroupMsg;
exports.sendMsg = sendMsg;
exports.sendReadAck = sendReadAck;
exports.setReadAckHandler = setReadAckHandler;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
