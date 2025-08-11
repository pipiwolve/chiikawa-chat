"use strict";
const common_vendor = require("../common/vendor.js");
let socketTask = null;
let reconnectTimer = null;
let reconnectCount = 0;
const MAX_RECONNECT = 6;
let currentUserId = null;
let messageQueue = [];
const QUEUE_KEY = "socket_message_queue";
function persistQueue() {
  try {
    common_vendor.index.setStorageSync(QUEUE_KEY, messageQueue);
    common_vendor.index.__f__("log", "at utils/socket.js:13", "[socket] 缓存队列已持久化，长度:", messageQueue.length);
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:15", "[socket] persistQueue error", e);
  }
}
function loadQueueFromStorage() {
  try {
    const q = common_vendor.index.getStorageSync(QUEUE_KEY);
    messageQueue = Array.isArray(q) ? q : [];
    common_vendor.index.__f__("log", "at utils/socket.js:22", "[socket] 从本地缓存恢复队列，长度:", messageQueue.length);
  } catch (e) {
    messageQueue = [];
  }
}
const CONNECT_STATUS = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2
};
let connectStatus = CONNECT_STATUS.DISCONNECTED;
function connectSocket(userId, onMessage) {
  if (connectStatus === CONNECT_STATUS.CONNECTED || connectStatus === CONNECT_STATUS.CONNECTING) {
    common_vendor.index.__f__("warn", "at utils/socket.js:38", "WebSocket 已经连接或正在连接中，跳过重复连接");
    return;
  }
  currentUserId = userId;
  connectStatus = CONNECT_STATUS.CONNECTING;
  common_vendor.index.__f__("log", "at utils/socket.js:44", "[socket] 准备连接 WebSocket，用户ID:", userId);
  const wsUrl = `ws://192.168.110.238:9326?name=${encodeURIComponent(userId)}`;
  socketTask = common_vendor.index.connectSocket({
    url: wsUrl,
    success() {
      common_vendor.index.__f__("log", "at utils/socket.js:50", "WebSocket 连接请求发起");
    },
    fail(err) {
      common_vendor.index.__f__("error", "at utils/socket.js:53", "WebSocket 连接请求失败", err);
      attemptReconnect(onMessage);
    }
  });
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:59", "📡 WebSocket 已打开");
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
      common_vendor.index.__f__("warn", "at utils/socket.js:77", "收到无效消息:", dataStr);
      return;
    }
    if (dataStr.trim().startsWith("{") || dataStr.trim().startsWith("[")) {
      try {
        const data = JSON.parse(dataStr);
        onMessage && onMessage(data);
      } catch (e) {
        common_vendor.index.__f__("error", "at utils/socket.js:86", "消息解析错误", e, dataStr);
      }
    } else {
      common_vendor.index.__f__("log", "at utils/socket.js:90", "收到非 JSON 消息:", dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:95", "WebSocket 已关闭");
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:101", "WebSocket 错误", err);
    connectStatus = CONNECT_STATUS.DISCONNECTED;
    attemptReconnect(onMessage);
  });
}
function attemptReconnect(onMessage) {
  if (reconnectCount >= MAX_RECONNECT) {
    common_vendor.index.__f__("warn", "at utils/socket.js:110", "重连次数达到上限，停止重连");
    return;
  }
  if (reconnectTimer)
    return;
  reconnectCount++;
  const delay = Math.min(3e4, 5e3 * Math.pow(2, reconnectCount - 1));
  common_vendor.index.__f__("log", "at utils/socket.js:117", `第${reconnectCount}次重连，${delay}ms后尝试`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket(currentUserId, onMessage);
  }, delay);
}
function flushQueue() {
  if (!messageQueue.length) {
    common_vendor.index.__f__("log", "at utils/socket.js:127", "[socket] flushQueue：无缓存消息需要发送");
    return;
  }
  common_vendor.index.__f__("log", "at utils/socket.js:130", "[socket] flushQueue start, 消息数量:", messageQueue.length);
  const sendNext = () => {
    if (!messageQueue.length) {
      common_vendor.index.__f__("log", "at utils/socket.js:134", "[socket] flushQueue 完成，缓存队列清空");
      persistQueue();
      return;
    }
    const item = messageQueue[0];
    try {
      socketTask.send({
        data: JSON.stringify(item),
        success() {
          common_vendor.index.__f__("log", "at utils/socket.js:143", "[socket] flushQueue 发送成功:", item);
          messageQueue.shift();
          persistQueue();
          setTimeout(sendNext, 50);
        },
        fail(err) {
          common_vendor.index.__f__("warn", "at utils/socket.js:149", "[socket] flush fail", err);
        }
      });
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:154", "[socket] flush exception", e);
    }
  };
  sendNext();
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
  common_vendor.index.__f__("log", "at utils/socket.js:170", "[socket] sendMsg 调用，消息:", data);
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
  common_vendor.index.__f__("log", "at utils/socket.js:183", "[socket] sendGroupMsg 调用，消息:", data);
  sendData(data, onStatusChange);
}
function sendData(data, onStatusChange) {
  if (connectStatus !== CONNECT_STATUS.CONNECTED) {
    common_vendor.index.__f__("warn", "at utils/socket.js:189", "WebSocket 未连接，消息加入队列缓存", data);
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("failed");
    return;
  }
  if (!socketTask) {
    common_vendor.index.__f__("error", "at utils/socket.js:196", "WebSocket 连接不存在，发送失败", data);
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
        common_vendor.index.__f__("log", "at utils/socket.js:206", "[socket] 消息发送成功", data);
        if (onStatusChange)
          onStatusChange("success");
      },
      fail(err) {
        common_vendor.index.__f__("error", "at utils/socket.js:210", "发送消息失败，加入缓存", err, data);
        messageQueue.push(data);
        persistQueue();
        if (onStatusChange)
          onStatusChange("failed");
      }
    });
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/socket.js:217", "发送消息异常，消息加入缓存", e, data);
    messageQueue.push(data);
    persistQueue();
    if (onStatusChange)
      onStatusChange("failed");
  }
}
function closeSocket() {
  if (socketTask) {
    common_vendor.index.__f__("log", "at utils/socket.js:226", "[socket] 主动关闭 WebSocket 连接");
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
