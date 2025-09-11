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
const multiHandlers = {};
const msgStatusCallbacks = /* @__PURE__ */ new Map();
const CONNECT_STATUS = { DISCONNECTED: 0, CONNECTING: 1, CONNECTED: 2 };
let connectStatus = CONNECT_STATUS.DISCONNECTED;
let onReplayGroupHistory = null;
let onJoinGroup = null;
let onPrivateHistory = null;
function connectSocket(userId, token, onMessage) {
  if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING)
    return;
  currentUserId = userId;
  connectStatus = CONNECT_STATUS.CONNECTING;
  const wsUrl = `ws://172.21.67.11:9326?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
  try {
    socketTask = common_vendor.index.connectSocket({
      url: wsUrl,
      success() {
        common_vendor.index.__f__("log", "at utils/socket.js:31", "WebSocket 连接请求已发起");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:32", "WebSocket 连接请求失败", err);
        attemptReconnect(onMessage);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:35", "WebSocket 连接异常", e);
    attemptReconnect(onMessage);
    return;
  }
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:41", "📡 WebSocket 已打开");
    connectStatus = CONNECT_STATUS.CONNECTED;
    reconnectCount = 0;
    loadQueueFromStorage();
    flushQueue();
  });
  socketTask.onMessage((msg) => {
    var _a;
    common_vendor.index.__f__("log", "at utils/socket.js:51", "[WS原始 res]", msg);
    const dataStr = msg.data;
    common_vendor.index.__f__("log", "at utils/socket.js:53", "[WS解析后的 data]", dataStr);
    if (!dataStr || dataStr === "null" || dataStr === "undefined")
      return;
    try {
      const data = JSON.parse(dataStr);
      common_vendor.index.__f__("log", "at utils/socket.js:59", "[WS解析后的 data]", data);
      dispatchMessage(data.cmd, data);
      if (data && typeof data === "object" && data.cmd === 101 && data.msgIds && Array.isArray(data.msgIds)) {
        if (data.toUser === currentUserId) {
          onReadAck && onReadAck(data.msgIds);
        }
        return;
      }
      if (data && data.cmd === 3) {
        (_a = cmdCallbacks[3]) == null ? void 0 : _a.call(cmdCallbacks, data);
        return;
      }
      onMessage && onMessage(data);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:79", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:84", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:90", "WebSocket 错误", err);
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
        common_vendor.index.__f__("warn", "at utils/socket.js:123", "[socket] flushQueue 发送失败:", err);
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:127", "[socket] flushQueue 异常:", e);
  }
}
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:133", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    messageQueue = Array.isArray(q) ? q : [];
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:140", "[socket] loadQueueFromStorage error", e);
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
      fail() {
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
function registerMultiHandler(cmd, callback) {
  if (!multiHandlers[cmd])
    multiHandlers[cmd] = [];
  if (!multiHandlers[cmd].includes(callback)) {
    multiHandlers[cmd].push(callback);
  }
}
function unregisterCmdHandler(cmd, callback) {
  if (cmdCallbacks[cmd])
    delete cmdCallbacks[cmd];
  if (multiHandlers[cmd]) {
    multiHandlers[cmd] = multiHandlers[cmd].filter((cb) => cb !== callback);
    if (multiHandlers[cmd].length === 0)
      delete multiHandlers[cmd];
  }
}
function dispatchMessage(cmd, data) {
  if (cmdCallbacks[cmd]) {
    try {
      cmdCallbacks[cmd](data);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:217", `[dispatchMessage] 单播 cmd=${cmd} 出错`, e);
    }
  }
  if (multiHandlers[cmd]) {
    multiHandlers[cmd].forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        common_vendor.index.__f__("error", "at utils/socket.js:224", `[dispatchMessage] 多播 cmd=${cmd} 出错`, e);
      }
    });
  }
}
function fetchSessions(onResult) {
  registerCmdHandler(200, onResult);
  sendCmdMessage(200);
}
function sendJoinGroupRequest(groupId, userId) {
  return new Promise((resolve, reject) => {
    const msg = {
      cmd: 214,
      groupId,
      fromUser: userId
    };
    try {
      sendCmdMessage(214, msg, (res) => {
        if (res)
          resolve(res);
        else
          reject(new Error("No response from server"));
      });
      common_vendor.index.__f__("log", "at utils/socket.js:268", "[sendJoinGroupRequest] 已发送加入群聊申请:", msg);
    } catch (e) {
      reject(e);
    }
  });
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
function setJoinGroupHandler(callback) {
  onJoinGroup = callback;
  registerCmdHandler(214, (msg) => {
    common_vendor.index.__f__("log", "at utils/socket.js:315", "[214] 收到加入群申请通知:", msg);
    onJoinGroup && onJoinGroup(msg);
  });
  registerCmdHandler(210, (msg) => {
    common_vendor.index.__f__("log", "at utils/socket.js:320", "[210] 群聊列表需要刷新:", msg);
    onJoinGroup && onJoinGroup(msg);
  });
}
function sendMsg(msg, onStatusChange) {
  const data = { cmd: 2, type: "private", ...msg };
  try {
    sendData(data);
    onStatusChange && onStatusChange("success");
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:333", "发送私聊失败", e);
    onStatusChange && onStatusChange("failed");
  }
}
function sendGroupMsg(msg, onStatusChange) {
  const data = { cmd: 3, type: "group", ...msg };
  try {
    sendData(data);
    onStatusChange && onStatusChange("success");
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:345", "发送群聊失败", e);
    onStatusChange && onStatusChange("failed");
  }
}
function fetchGroupRequests() {
  const userId = common_vendor.index.getStorageSync("currentUserId") || "";
  sendCmdMessage(215, { fromUser: userId });
}
function onPrivateMessage(callback) {
  registerMultiHandler(2, callback);
}
function onGroupMessage(callback) {
  registerMultiHandler(3, callback);
}
registerMultiHandler(2, (msg) => {
  common_vendor.index.__f__("log", "at utils/socket.js:368", "[socket.js] 收到私聊消息:", msg);
  fetchSessions((resp) => {
    common_vendor.index.__f__("log", "at utils/socket.js:372", "[socket.js] 刷新会话（私聊消息触发）:", resp.sessions);
    common_vendor.index.setStorageSync("latestSessions", resp.sessions || []);
    common_vendor.index.$emit("sessionsUpdated", resp);
  });
});
registerMultiHandler(3, (msg) => {
  common_vendor.index.__f__("log", "at utils/socket.js:381", "[socket.js] 收到群聊消息:", msg);
  fetchSessions((resp) => {
    common_vendor.index.__f__("log", "at utils/socket.js:384", "[socket.js] 刷新会话（群聊消息触发）:", resp.sessions);
    common_vendor.index.setStorageSync("latestSessions", resp.sessions || []);
    common_vendor.index.$emit("sessionsUpdated", resp);
  });
});
function sendReadAck(msgIds, peerId) {
  if (!Array.isArray(msgIds) || msgIds.length === 0)
    return;
  if (!peerId)
    return;
  const ackData = { cmd: 100, fromUser: currentUserId, toUser: peerId, msgIds };
  if (socketTask && connectStatus === CONNECT_STATUS.CONNECTED) {
    try {
      socketTask.send({ data: JSON.stringify(ackData) });
      common_vendor.index.__f__("log", "at utils/socket.js:397", "发送已读回执:", ackData);
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
function sendGroupHistoryRequest(groupId, pageNum, pageSize, cursorMsgId) {
  sendCmdMessage(103, { groupId, pageNum, pageSize, cursorMsgId });
}
function setGroupHistoryHandler(callback) {
  onGroupHistory = callback;
  registerCmdHandler(103, (msg) => {
    if (!msg || !Array.isArray(msg.data))
      return;
    const arr = msg.data.map((m) => ({ ...m, type: "group" }));
    onGroupHistory && onGroupHistory(arr);
  });
}
function sendReplayGroupHistoryRequest(groupId) {
  sendCmdMessage(104, { groupId });
}
function setReplayGroupHistoryHandler(callback) {
  onReplayGroupHistory = callback;
  registerCmdHandler(104, (msg) => {
    if (!msg)
      return;
    const arr = msg.data || [];
    if (!Array.isArray(arr))
      return;
    onReplayGroupHistory && onReplayGroupHistory(arr);
  });
}
function sendGroupCursor(groupId, msgId) {
  sendCmdMessage(102, { groupId, msgId });
}
function setReadAckHandler(callback) {
  onReadAck = callback;
  registerCmdHandler(101, (msg) => {
    if (!msg)
      return;
    if (msg.toUser === currentUserId && Array.isArray(msg.msgIds)) {
      onReadAck && onReadAck(msg.msgIds);
    }
  });
}
function isConnected() {
  return connectStatus === CONNECT_STATUS.CONNECTED;
}
function sendPrivateHistoryRequest(peerId, pageNum = 1, pageSize = 50, cursorMsgId = null) {
  sendCmdMessage(105, { peerId, pageNum, pageSize, cursorMsgId });
}
function setPrivateHistoryHandler(callback) {
  onPrivateHistory = callback;
  registerCmdHandler(105, (msg) => {
    if (!msg)
      return;
    const arr = Array.isArray(msg.data) ? msg.data : Array.isArray(msg) ? msg : [];
    arr.forEach((m) => {
      if (m)
        m.type = "private";
    });
    onPrivateHistory && onPrivateHistory(arr);
  });
}
exports.connectSocket = connectSocket;
exports.createGroup = createGroup;
exports.fetchFriendRequests = fetchFriendRequests;
exports.fetchFriends = fetchFriends;
exports.fetchGroupRequests = fetchGroupRequests;
exports.fetchGroups = fetchGroups;
exports.fetchOfflinePrivateMessages = fetchOfflinePrivateMessages;
exports.fetchSessions = fetchSessions;
exports.isConnected = isConnected;
exports.onGroupMessage = onGroupMessage;
exports.onPrivateMessage = onPrivateMessage;
exports.registerCmdHandler = registerCmdHandler;
exports.respondFriendRequest = respondFriendRequest;
exports.sendCmdMessage = sendCmdMessage;
exports.sendFriendRequest = sendFriendRequest;
exports.sendGroupCursor = sendGroupCursor;
exports.sendGroupHistoryRequest = sendGroupHistoryRequest;
exports.sendGroupMsg = sendGroupMsg;
exports.sendJoinGroupRequest = sendJoinGroupRequest;
exports.sendMsg = sendMsg;
exports.sendPrivateHistoryRequest = sendPrivateHistoryRequest;
exports.sendReadAck = sendReadAck;
exports.sendReplayGroupHistoryRequest = sendReplayGroupHistoryRequest;
exports.setGroupHistoryHandler = setGroupHistoryHandler;
exports.setJoinGroupHandler = setJoinGroupHandler;
exports.setPrivateHistoryHandler = setPrivateHistoryHandler;
exports.setReadAckHandler = setReadAckHandler;
exports.setReplayGroupHistoryHandler = setReplayGroupHistoryHandler;
exports.unregisterCmdHandler = unregisterCmdHandler;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
