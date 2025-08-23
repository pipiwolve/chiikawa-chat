"use strict";
const common_vendor = require("../common/vendor.js");
let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;
let onGroupHistory = null;
let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = "socket_message_queue";
let onReadAck = null;
const msgStatusCallbacks = /* @__PURE__ */ new Map();
const CONNECT_STATUS = { DISCONNECTED: 0, CONNECTING: 1, CONNECTED: 2 };
let connectStatus = CONNECT_STATUS.DISCONNECTED;
function connectSocket(userId, onMessage) {
  if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING)
    return;
  currentUserId = userId;
  connectStatus = CONNECT_STATUS.CONNECTING;
  const wsUrl = `ws://172.20.10.18:9326?name=${encodeURIComponent(userId)}`;
  try {
    socketTask = common_vendor.index.connectSocket({
      url: wsUrl,
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:29", "WebSocket 连接请求已发起");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:30", "WebSocket 连接请求失败", err);
        attemptReconnect(onMessage);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:33", "WebSocket 连接异常", e);
    attemptReconnect(onMessage);
    return;
  }
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:39", "📡 WebSocket 已打开");
    connectStatus = CONNECT_STATUS.CONNECTED;
    reconnectCount = 0;
    sendRaw({ cmd: 1, fromUser: currentUserId });
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
        if (data.toUser === currentUserId) {
          onReadAck && onReadAck(data.msgIds);
        }
        return;
      }
      if (Array.isArray(data) && data.length && data[0].cmd === 3) {
        onGroupHistory && onGroupHistory(data);
        return;
      }
      onMessage && onMessage(data);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:73", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:78", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:84", "WebSocket 错误", err);
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
}
function attemptReconnect(onMessage) {
  if (reconnectCount >= MAX_RECONNECT)
    return;
  if (reconnectTimer)
    return;
  reconnectCount++;
  const delay = Math.min(3e4, 5e3 * Math.pow(2, reconnectCount - 1));
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
      common_vendor.index.__f__("error", "at utils/socket.js:106", "[socket] 发送消息异常", e, data);
    }
  } else {
    common_vendor.index.__f__("warn", "at utils/socket.js:108", "[socket] WebSocket未连接，无法发送消息:", data);
  }
}
function flushQueue() {
  if (!messageQueue.length) {
    persistQueue();
    return;
  }
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
        common_vendor.index.__f__("warn", "at utils/socket.js:125", "[socket] flushQueue 发送失败:", err);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:129", "[socket] flushQueue 异常:", e);
  }
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:135", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    messageQueue = Array.isArray(q) ? q : [];
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:142", "[socket] loadQueueFromStorage error", e);
    messageQueue = [];
  }
}
function sendData(data, onStatusChange) {
  if (onStatusChange)
    msgStatusCallbacks.set(data.msgId, onStatusChange);
  if (onStatusChange)
    onStatusChange("sending");
  if (connectStatus !== CONNECT_STATUS.CONNECTED || !socketTask) {
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
        if (onStatusChange)
          onStatusChange("success");
        msgStatusCallbacks.delete(data.msgId);
      },
      fail(err) {
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange)
          onStatusChange("failed");
        msgStatusCallbacks.delete(data.msgId);
      }
    });
  } catch (e) {
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("failed");
    msgStatusCallbacks.delete(data.msgId);
  }
}
function sendMsg(msg, onStatusChange) {
  const data = { cmd: 2, type: "private", ...msg };
  sendData(data, onStatusChange);
}
function sendGroupMsg(msg, onStatusChange) {
  const data = { cmd: 3, type: "group", ...msg };
  sendData(data, onStatusChange);
}
function sendReadAck(msgIds) {
  if (!Array.isArray(msgIds) || msgIds.length === 0)
    return;
  const ackData = { cmd: 100, fromUser: currentUserId, msgIds };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(ackData) });
    } catch (e) {
      messageQueue.push(ackData);
      persistQueue();
    }
  } else {
    messageQueue.push(ackData);
    persistQueue();
  }
}
function sendGroupCursor(groupId, lastMsgId) {
  if (!groupId)
    return;
  const data = { cmd: 102, fromUser: currentUserId, groupId, lastMsgId, timestamp: Date.now() };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(data) });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:206", "[socket] sendGroupCursor error", e);
    }
  }
}
function setGroupHistoryHandler(callback) {
  onGroupHistory = callback;
}
function setReadAckHandler(callback) {
  onReadAck = callback;
}
function closeSocket() {
  if (socketTask) {
    socketTask.close();
    socketTask = null;
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    if (reconnectTimer)
      clearTimeout(reconnectTimer);
    reconnectTimer = null;
    reconnectCount = 0;
  }
}
function isConnected() {
  return connectStatus === CONNECT_STATUS.CONNECTED;
}
exports.closeSocket = closeSocket;
exports.connectSocket = connectSocket;
exports.isConnected = isConnected;
exports.sendGroupCursor = sendGroupCursor;
exports.sendGroupMsg = sendGroupMsg;
exports.sendMsg = sendMsg;
exports.sendReadAck = sendReadAck;
exports.setGroupHistoryHandler = setGroupHistoryHandler;
exports.setReadAckHandler = setReadAckHandler;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
