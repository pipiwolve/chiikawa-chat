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
const ackTimers = /* @__PURE__ */ new Map();
const CONNECT_STATUS = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;
function connectSocket(userId, onMessage) {
  if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
    common_vendor.index.__f__("warn", "at utils/socket.js:23", "WebSocket 已经连接或正在连接中，跳过重复连接");
    return;
  }
  currentUserId = userId;
  connectStatus = CONNECT_STATUS.CONNECTING;
  common_vendor.index.__f__("log", "at utils/socket.js:29", "[socket] 准备连接 WebSocket，用户ID:", userId);
  const wsUrl = `ws://192.168.110.238:9326?name=${encodeURIComponent(userId)}`;
  try {
    socketTask = common_vendor.index.connectSocket({
      url: wsUrl,
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:36", "WebSocket 连接请求已发起");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:37", "WebSocket 连接请求失败", err);
        attemptReconnect(onMessage);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:40", "WebSocket 连接异常", e);
    attemptReconnect(onMessage);
    return;
  }
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:46", "📡 WebSocket 已打开");
    connectStatus = CONNECT_STATUS.CONNECTED;
    reconnectCount = 0;
    const loginData = { cmd: 1, from: currentUserId };
    sendRaw(loginData);
    loadQueueFromStorage();
    autoSendOfflineReadAck();
    flushQueue();
  });
  socketTask.onMessage((res) => {
    const dataStr = res.data;
    if (!dataStr || dataStr === "null" || dataStr === "undefined")
      return;
    try {
      const data = JSON.parse(dataStr);
      if (data.cmd === 101 && data.msgIds && Array.isArray(data.msgIds)) {
        if (currentUserId === data.from) {
          onReadAck && onReadAck(data.msgIds);
        }
      } else if (data.cmd === -1 && data.msgId) {
        const cb = msgStatusCallbacks.get(data.msgId);
        if (cb) {
          cb("success");
          msgStatusCallbacks.delete(data.msgId);
        }
        if (ackTimers.has(data.msgId)) {
          clearTimeout(ackTimers.get(data.msgId));
          ackTimers.delete(data.msgId);
        }
      } else {
        onMessage && onMessage(data);
        if (data.msgId && data.cmd !== 101 && data.cmd !== -1)
          sendAck(data.msgId);
      }
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:83", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:88", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:94", "WebSocket 错误", err);
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
}
function autoSendOfflineReadAck() {
  if (!messageQueue.length)
    return;
  const offlineMsgIds = messageQueue.filter((item) => item.msgId && item.from !== currentUserId).map((item) => item.msgId);
  if (offlineMsgIds.length > 0)
    sendReadAck(offlineMsgIds);
}
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
    common_vendor.index.__f__("log", "at utils/socket.js:120", "[socket] 缓存队列已持久化，长度:", messageQueue.length);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:122", "[socket] persistQueue error", e);
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
    messageQueue = messageQueue.filter((item) => {
      return !(item && (item.cmd === 99 || item.cmd === 100));
    });
    common_vendor.index.__f__("log", "at utils/socket.js:137", "[socket] 从本地缓存恢复队列，长度:", messageQueue.length);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:139", "[socket] 从本地缓存恢复队列异常", e);
    messageQueue = [];
  }
}
function attemptReconnect(onMessage) {
  if (reconnectCount >= MAX_RECONNECT) {
    common_vendor.index.__f__("warn", "at utils/socket.js:146", "重连次数达到上限，停止重连");
    return;
  }
  if (reconnectTimer)
    return;
  reconnectCount++;
  const delay = Math.min(3e4, 5e3 * Math.pow(2, reconnectCount - 1));
  common_vendor.index.__f__("log", "at utils/socket.js:153", `第${reconnectCount}次重连，${delay}ms后尝试`);
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
      common_vendor.index.__f__("error", "at utils/socket.js:166", "[socket] 发送消息异常", e, data);
    }
  } else {
    common_vendor.index.__f__("warn", "at utils/socket.js:169", "[socket] WebSocket未连接，无法发送消息:", data);
  }
}
function flushQueue(onMessage) {
  if (!messageQueue.length) {
    common_vendor.index.__f__("log", "at utils/socket.js:175", "[socket] flushQueue：无缓存消息需要发送");
    return;
  }
  common_vendor.index.__f__("log", "at utils/socket.js:178", "[socket] flushQueue start, 消息数量:", messageQueue.length);
  const sendNext = () => {
    if (!messageQueue.length) {
      common_vendor.index.__f__("log", "at utils/socket.js:182", "[socket] flushQueue 完成，缓存队列清空");
      persistQueue();
      return;
    }
    const item = messageQueue[0];
    try {
      socketTask.send({
        data: JSON.stringify(item),
        success() {
          common_vendor.index.__f__("log", "at utils/socket.js:191", "[socket] flushQueue 发送成功:", item);
          setupAckTimeout(item.msgId);
          messageQueue.shift();
          persistQueue();
          setTimeout(sendNext, 50);
        },
        fail(err) {
          common_vendor.index.__f__("warn", "at utils/socket.js:198", "[socket] flushQueue 发送失败", err);
        }
      });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:203", "[socket] flushQueue 异常", e);
    }
  };
  sendNext();
}
function setupAckTimeout(msgId) {
  if (!msgId)
    return;
  if (ackTimers.has(msgId)) {
    clearTimeout(ackTimers.get(msgId));
  }
  const timerId = setTimeout(() => {
    const cb = msgStatusCallbacks.get(msgId);
    if (cb) {
      cb("failed");
      msgStatusCallbacks.delete(msgId);
    }
    ackTimers.delete(msgId);
  }, 5e3);
  ackTimers.set(msgId, timerId);
}
function sendData(data, onStatusChange) {
  if (!data.msgId) {
    data.msgId = generateUUID();
  }
  if (onStatusChange && typeof onStatusChange === "function") {
    msgStatusCallbacks.set(data.msgId, onStatusChange);
  }
  if (onStatusChange)
    onStatusChange("sending");
  if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
    common_vendor.index.__f__("warn", "at utils/socket.js:235", "WebSocket 未连接，消息加入队列缓存", data);
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
        common_vendor.index.__f__("log", "at utils/socket.js:246", "[socket] 消息发送成功", data);
        setupAckTimeout(data.msgId);
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:250", "发送消息失败，加入缓存", err, data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange)
          onStatusChange("failed");
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:257", "发送消息异常，消息加入缓存", e, data);
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
function sendAck(msgId) {
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    const ackData = {
      cmd: 99,
      msgId
    };
    try {
      socketTask.send({ data: JSON.stringify(ackData) });
      common_vendor.index.__f__("log", "at utils/socket.js:305", "[socket] 发送ACK确认消息:", ackData);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:307", "[socket] 发送ACK消息失败", e);
    }
  }
}
function sendReadAck(msgIds) {
  if (!Array.isArray(msgIds) || msgIds.length === 0) {
    common_vendor.index.__f__("warn", "at utils/socket.js:314", "[socket] sendReadAck 缺少 msgIds");
    return;
  }
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    const ackData = {
      cmd: 100,
      msgIds
    };
    try {
      socketTask.send({ data: JSON.stringify(ackData) });
      common_vendor.index.__f__("log", "at utils/socket.js:324", "[socket] 发送已读确认:", ackData);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:326", "[socket] 发送已读确认失败", e);
    }
  }
}
function setReadAckHandler(callback) {
  onReadAck = callback;
}
function closeSocket() {
  if (socketTask) {
    common_vendor.index.__f__("log", "at utils/socket.js:337", "[socket] 主动关闭 WebSocket 连接");
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
