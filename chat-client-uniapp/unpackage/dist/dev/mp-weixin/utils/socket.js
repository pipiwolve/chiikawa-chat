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
  const wsUrl = `ws://192.168.110.238:9326`;
  try {
    socketTask = common_vendor.index.connectSocket({
      url: wsUrl,
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:27", "WebSocket 连接请求已发起");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:28", "WebSocket 连接请求失败", err);
        attemptReconnect(onMessage);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:31", "WebSocket 连接异常", e);
    attemptReconnect(onMessage);
    return;
  }
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:37", "📡 WebSocket 已打开");
    connectStatus = CONNECT_STATUS.CONNECTED;
    reconnectCount = 0;
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
      if (Array.isArray(data) && data.length && (data[0].cmd === 3 || data[0].cmd === 103)) {
        onGroupHistory && onGroupHistory(data);
        return;
      }
      onMessage && onMessage(data);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:69", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:74", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:80", "WebSocket 错误", err);
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
        common_vendor.index.__f__("warn", "at utils/socket.js:121", "[socket] flushQueue 发送失败:", err);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:125", "[socket] flushQueue 异常:", e);
  }
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:131", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    messageQueue = Array.isArray(q) ? q : [];
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:138", "[socket] loadQueueFromStorage error", e);
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
function sendCmdMessage(cmd, payload = {}, onStatusChange) {
  const data = { cmd, fromUser: currentUserId, ...payload };
  sendData(data, onStatusChange);
}
function sendRegister(userId, password, nickname) {
  sendCmdMessage(10, { fromUser: userId, content: password, nickname });
}
function sendLogin(userId, password) {
  sendCmdMessage(11, { fromUser: userId, content: password });
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
  const data = { cmd: 102, fromUser: currentUserId, groupId, msgId: lastMsgId, timestamp: Date.now() };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(data) });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:217", "[socket] sendGroupCursor error", e);
    }
  }
}
function sendGroupHistoryRequest(groupId, pageNum, pageSize) {
  if (!groupId)
    return;
  const data = { cmd: 103, fromUser: currentUserId, groupId, pageNum, pageSize, timestamp: Date.now() };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(data) });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:226", "[socket] sendGroupHistoryRequest error", e);
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
exports.sendGroupHistoryRequest = sendGroupHistoryRequest;
exports.sendGroupMsg = sendGroupMsg;
exports.sendLogin = sendLogin;
exports.sendMsg = sendMsg;
exports.sendReadAck = sendReadAck;
exports.sendRegister = sendRegister;
exports.setGroupHistoryHandler = setGroupHistoryHandler;
exports.setReadAckHandler = setReadAckHandler;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
