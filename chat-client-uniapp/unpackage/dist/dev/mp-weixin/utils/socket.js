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
let cmdCallbacks = {};
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
        common_vendor.index.__f__("log", "at utils/socket.js:28", "WebSocket 连接请求已发起");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:29", "WebSocket 连接请求失败", err);
        attemptReconnect(onMessage);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:32", "WebSocket 连接异常", e);
    attemptReconnect(onMessage);
    return;
  }
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:38", "📡 WebSocket 已打开");
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
      if (data.cmd && cmdCallbacks[data.cmd]) {
        cmdCallbacks[data.cmd](data);
        return;
      }
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
      common_vendor.index.__f__("error", "at utils/socket.js:76", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:81", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:87", "WebSocket 错误", err);
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
        common_vendor.index.__f__("warn", "at utils/socket.js:120", "[socket] flushQueue 发送失败:", err);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:124", "[socket] flushQueue 异常:", e);
  }
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:130", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    messageQueue = Array.isArray(q) ? q : [];
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:137", "[socket] loadQueueFromStorage error", e);
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
function sendCmdMessage(cmd, payload = {}) {
  const data = { cmd, fromUser: currentUserId, ...payload };
  sendData(data);
}
function registerCmdHandler(cmd, callback) {
  cmdCallbacks[cmd] = callback;
}
function unregisterCmdHandler(cmd) {
  delete cmdCallbacks[cmd];
}
function sendRegister(userId, password, nickname) {
  sendCmdMessage(10, { fromUser: userId, content: password, nickname });
}
function sendLogin(userId, password) {
  sendCmdMessage(11, { fromUser: userId, content: password });
}
function fetchSessions(onResult) {
  registerCmdHandler(200, onResult);
  sendCmdMessage(200);
}
function joinGroup(groupId, role = "member") {
  sendCmdMessage(201, { groupId, role });
}
function sendFriendRequest(toUser) {
  sendCmdMessage(202, { toUser });
}
function createGroup(groupName, members) {
  sendCmdMessage(203, { content: groupName, msgIds: members });
}
function fetchFriendRequests(onResult) {
  registerCmdHandler(209, onResult);
  sendCmdMessage(209);
}
function respondFriendRequest(requester, fromUser, action) {
  sendCmdMessage(206, { requester, fromUser, action });
}
function fetchFriends(onResult) {
  registerCmdHandler(208, onResult);
  sendCmdMessage(208);
}
function fetchGroups(onResult) {
  registerCmdHandler(212, onResult);
  sendCmdMessage(212);
}
function sendMsg(msg, onStatusChange) {
  const data = { cmd: 2, type: "private", ...msg };
  try {
    sendData(data);
    onStatusChange && onStatusChange("success");
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:257", "发送私聊失败", e);
    onStatusChange && onStatusChange("failed");
  }
}
function sendGroupMsg(msg, onStatusChange) {
  const data = { cmd: 3, type: "group", ...msg };
  try {
    sendData(data);
    onStatusChange && onStatusChange("success");
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:269", "发送群聊失败", e);
    onStatusChange && onStatusChange("failed");
  }
}
function onPrivateMessage(callback) {
  registerCmdHandler(2, callback);
}
function onGroupMessage(callback) {
  registerCmdHandler(3, callback);
}
function sendReadAck(msgIds) {
  if (!Array.isArray(msgIds) || msgIds.length === 0)
    return;
  const ackData = { cmd: 100, fromUser: currentUserId, msgIds };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(ackData) });
      common_vendor.index.__f__("log", "at utils/socket.js:287", "发送已读回执:", ackData);
    } catch (e) {
      messageQueue.push(ackData);
      persistQueue();
    }
  } else {
    messageQueue.push(ackData);
    persistQueue();
  }
}
function fetchOfflinePrivateMessages(toUser, onResult) {
  if (!toUser)
    return;
  const payload = { toUser };
  const cmd = 211;
  registerCmdHandler(cmd, onResult);
  sendCmdMessage(cmd, payload);
}
function sendGroupCursor(groupId, lastMsgId) {
  if (!groupId)
    return;
  const data = { cmd: 102, fromUser: currentUserId, groupId, msgId: lastMsgId, timestamp: Date.now() };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(data) });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:308", "[socket] sendGroupCursor error", e);
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
      common_vendor.index.__f__("error", "at utils/socket.js:317", "[socket] sendGroupHistoryRequest error", e);
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
exports.createGroup = createGroup;
exports.fetchFriendRequests = fetchFriendRequests;
exports.fetchFriends = fetchFriends;
exports.fetchGroups = fetchGroups;
exports.fetchOfflinePrivateMessages = fetchOfflinePrivateMessages;
exports.fetchSessions = fetchSessions;
exports.isConnected = isConnected;
exports.joinGroup = joinGroup;
exports.onGroupMessage = onGroupMessage;
exports.onPrivateMessage = onPrivateMessage;
exports.registerCmdHandler = registerCmdHandler;
exports.respondFriendRequest = respondFriendRequest;
exports.sendFriendRequest = sendFriendRequest;
exports.sendGroupCursor = sendGroupCursor;
exports.sendGroupHistoryRequest = sendGroupHistoryRequest;
exports.sendGroupMsg = sendGroupMsg;
exports.sendLogin = sendLogin;
exports.sendMsg = sendMsg;
exports.sendReadAck = sendReadAck;
exports.sendRegister = sendRegister;
exports.setGroupHistoryHandler = setGroupHistoryHandler;
exports.setReadAckHandler = setReadAckHandler;
exports.unregisterCmdHandler = unregisterCmdHandler;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
