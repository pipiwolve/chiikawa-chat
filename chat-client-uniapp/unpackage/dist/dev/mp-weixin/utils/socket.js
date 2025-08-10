"use strict";
const common_vendor = require("../common/vendor.js");
let socketTask = null;
function connectSocket(userId, onMessage) {
  socketTask = common_vendor.index.connectSocket({
    url: "ws://192.168.110.238:9326",
    // 请替换成你的局域网IP和端口
    success() {
      common_vendor.index.__f__("log", "at utils/socket.js:7", " WebSocket 连接成功");
    },
    fail(err) {
      common_vendor.index.__f__("error", "at utils/socket.js:10", " WebSocket 连接失败", err);
    }
  });
  socketTask.onOpen(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:15", "📡 WebSocket 已打开");
    const loginData = {
      cmd: 1,
      from: userId
    };
    socketTask.send({ data: JSON.stringify(loginData) });
  });
  socketTask.onMessage((res) => {
    const dataStr = res.data;
    if (!dataStr || dataStr === "null" || dataStr === "undefined") {
      common_vendor.index.__f__("warn", "at utils/socket.js:27", "收到无效消息:", dataStr);
      return;
    }
    try {
      const data = JSON.parse(dataStr);
      onMessage && onMessage(data);
    } catch (e) {
      common_vendor.index.__f__("error", "at utils/socket.js:34", "消息解析错误", e, dataStr);
    }
  });
  socketTask.onClose(() => {
    common_vendor.index.__f__("log", "at utils/socket.js:39", "WebSocket 已关闭");
  });
  socketTask.onError((err) => {
    common_vendor.index.__f__("error", "at utils/socket.js:43", "WebSocket 错误", err);
  });
}
function sendMsg(toUserId, msg, fromUserId) {
  const data = {
    cmd: 2,
    type: "private",
    from: fromUserId,
    to: toUserId,
    message: msg,
    timestamp: Date.now()
  };
  socketTask.send({ data: JSON.stringify(data) });
}
exports.connectSocket = connectSocket;
exports.sendMsg = sendMsg;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/socket.js.map
