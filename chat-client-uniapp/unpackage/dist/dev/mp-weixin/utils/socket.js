"use strict";
const common_vendor = require("../common/vendor.js");
let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;
let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = "socket_message_queue";
const msgStatusCallbacks = /* @__PURE__ */ new Map();
const ackTimers = /* @__PURE__ */ new Map();
const CONNECT_STATUS = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
    common_vendor.index.__f__("log", "at utils/socket.js:35", "[socket] 缓存队列已持久化，长度:", messageQueue.length);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:37", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    messageQueue = Array.isArray(q) ? q : [];
    common_vendor.index.__f__("log", "at utils/socket.js:45", "[socket] 从本地缓存恢复队列，长度:", messageQueue.length);
  } catch (e) {
    messageQueue = [];
  }
}
function connectSocket(userId, onMessage) {
  if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
    common_vendor.index.__f__("warn", "at utils/socket.js:53", "WebSocket 已经连接或正在连接中，跳过重复连接");
    return;
  }
  currentUserId = userId;
  connectStatus = CONNECT_STATUS.CONNECTING;
  common_vendor.index.__f__("log", "at utils/socket.js:59", "[socket] 准备连接 WebSocket，用户ID:", userId);
  const wsUrl = `ws://192.168.2.5:9326?name=${encodeURIComponent(userId)}`;
  socketTask = common_vendor.index.connectSocket({
    url: wsUrl,
    success() {
      common_vendor.index.__f__("log", "at utils/socket.js:65", "WebSocket 连接请行求发起");
    },
    fail(err) {
      common_vendor.index.__f__("error", "at utils/socket.js:68", "WebSocket 连接请求失败", err);
      attemptReconnect(onMessage);
    }
  });
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:74", "📡 WebSocket 已打开");
    connectStatus = CONNECT_STATUS.CONNECTED;
    reconnectCount = 0;
    const loginData = {
      cmd: 1,
      from: currentUserId
    };
    socketTask.send({ data: JSON.stringify(loginData) });
    loadQueueFromStorage();
    flushQueue();
  });
  socketTask.onMessage((res) => {
    const dataStr = res.data;
    if (!dataStr || dataStr === "null" || dataStr === "undefined") {
      common_vendor.index.__f__("warn", "at utils/socket.js:92", "收到无效消息:", dataStr);
      return;
    }
    if (dataStr.trim().startsWith("{") || dataStr.trim().startsWith("[")) {
      try {
        const data = JSON.parse(dataStr);
        if (data.cmd === -1 && data.msgId) {
          const cb = msgStatusCallbacks.get(data.msgId);
          if (cb) {
            cb("success");
            common_vendor.index.__f__("log", "at utils/socket.js:104", "安全握手成功～");
            msgStatusCallbacks.delete(data.msgId);
          }
          if (ackTimers.has(data.msgId)) {
            clearTimeout(ackTimers.get(data.msgId));
            ackTimers.delete(data.msgId);
          }
          return;
        }
        onMessage && onMessage(data);
      } catch (e) {
        common_vendor.index.__f__("error", "at utils/socket.js:118", "消息解析错误", e, dataStr);
      }
    } else {
      common_vendor.index.__f__("log", "at utils/socket.js:121", "收到非 JSON 消息:", dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:126", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:132", "WebSocket 错误", err);
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
}
function attemptReconnect(onMessage) {
  if (reconnectCount >= MAX_RECONNECT) {
    common_vendor.index.__f__("warn", "at utils/socket.js:140", "重连次数达到上限，停止重连");
    return;
  }
  if (reconnectTimer)
    return;
  reconnectCount++;
  const delay = Math.min(3e4, 5e3 * Math.pow(2, reconnectCount - 1));
  common_vendor.index.__f__("log", "at utils/socket.js:147", `第${reconnectCount}次重连，${delay}ms后尝试`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket(currentUserId, onMessage);
  }, delay);
}
function flushQueue() {
  if (!messageQueue.length) {
    common_vendor.index.__f__("log", "at utils/socket.js:157", "[socket] flushQueue：无缓存消息需要发送");
    return;
  }
  common_vendor.index.__f__("log", "at utils/socket.js:160", "[socket] flushQueue start, 消息数量:", messageQueue.length);
  const sendNext = () => {
    if (!messageQueue.length) {
      common_vendor.index.__f__("log", "at utils/socket.js:164", "[socket] flushQueue 完成，缓存队列清空");
      persistQueue();
      return;
    }
    const item = messageQueue[0];
    try {
      socketTask.send({
        data: JSON.stringify(item),
        success() {
          common_vendor.index.__f__("log", "at utils/socket.js:173", "[socket] flushQueue 发送成功:", item);
          if (item.msgId && msgStatusCallbacks.has(item.msgId)) {
            msgStatusCallbacks.get(item.msgId)("sending");
            if (ackTimers.has(item.msgId)) {
              clearTimeout(ackTimers.get(item.msgId));
            }
            const timerId = setTimeout(() => {
              const cb = msgStatusCallbacks.get(item.msgId);
              if (cb) {
                cb("failed");
                msgStatusCallbacks.delete(item.msgId);
              }
              ackTimers.delete(item.msgId);
            }, 5e3);
            ackTimers.set(item.msgId, timerId);
          }
          messageQueue.shift();
          persistQueue();
          setTimeout(sendNext, 50);
        },
        fail(err) {
          common_vendor.index.__f__("warn", "at utils/socket.js:195", "[socket] flush fail", err);
          if (item.msgId && msgStatusCallbacks.has(item.msgId)) {
            msgStatusCallbacks.get(item.msgId)("failed");
          }
        }
      });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:202", "[socket] flush exception", e);
    }
  };
  sendNext();
}
function sendData(data, onStatusChange) {
  if (!data.msgId) {
    data.msgId = generateUUID();
  }
  if (onStatusChange && typeof onStatusChange === "function") {
    msgStatusCallbacks.set(data.msgId, onStatusChange);
  }
  if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
    common_vendor.index.__f__("warn", "at utils/socket.js:216", "WebSocket 未连接，消息加入队列缓存", data);
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("failed");
    return;
  }
  try {
    socketTask.send({
      data: JSON.stringify(data),
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:226", "[socket] 消息发送成功", data);
        if (onStatusChange)
          onStatusChange("sending");
        if (ackTimers.has(data.msgId)) {
          clearTimeout(ackTimers.get(data.msgId));
        }
        const timerId = setTimeout(() => {
          const cb = msgStatusCallbacks.get(data.msgId);
          if (cb) {
            cb("failed");
            msgStatusCallbacks.delete(data.msgId);
          }
          ackTimers.delete(data.msgId);
        }, 5e3);
        ackTimers.set(data.msgId, timerId);
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:243", "发送消息失败，加入缓存", err, data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange)
          onStatusChange("failed");
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:250", "发送消息异常，消息加入缓存", e, data);
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("failed");
  }
}
function sendMsg(toUserId, msg, fromUserId, onStatusChange) {
  const data = {
    cmd: 2,
    type: "private",
    from: fromUserId,
    to: toUserId,
    message: msg,
    timestamp: Date.now()
  };
  sendData(data, onStatusChange);
}
function sendGroupMsg(groupId, msg, fromUserId, onStatusChange) {
  const data = {
    cmd: 3,
    type: "group",
    from: fromUserId,
    to: groupId,
    message: msg,
    timestamp: Date.now()
  };
  sendData(data, onStatusChange);
}
function closeSocket() {
  if (socketTask) {
    common_vendor.index.__f__("log", "at utils/socket.js:292", "[socket] 主动关闭 WebSocket 连接");
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
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
