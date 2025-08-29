"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      messages: [],
      groupMessages: {},
      inputMsg: "",
      userId: "",
      targetId: "",
      targetType: "",
      currentTargetName: "",
      currentTargetAvatar: "",
      connectionStatus: "未连接",
      scrollTop: 0,
      msgStatusMap: {},
      unreadMsgIdsBuffer: [],
      unreadMsgIdsTimer: null,
      groupPageNum: 1,
      groupPageSize: 20,
      groupHasMore: true,
      loadingHistory: false
    };
  },
  onLoad(options) {
    common_vendor.index.__f__("log", "at pages/chat/chat.vue:100", "进入聊天页:", options);
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.targetId = options.targetId;
    this.targetType = options.type;
    this.currentTargetName = options.name || "";
    this.currentTargetAvatar = options.avatar || "";
    this.connectionStatus = "连接中...";
    utils_socket.setReadAckHandler((msgIds) => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]));
    utils_socket.setGroupHistoryHandler((arr) => {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
    });
    if (this.targetType === "private") {
      utils_socket.fetchOfflinePrivateMessages(this.targetId, (offlineMsgs) => {
        if (Array.isArray(offlineMsgs)) {
          offlineMsgs.forEach((m) => this.messages.push({ ...m, isOffline: true, status: "success" }));
          const unreadIds = offlineMsgs.filter((m) => m.fromUser === this.targetId).map((m) => m.msgId);
          if (unreadIds.length > 0)
            this.collectUnreadMsgIds(unreadIds);
          this.$nextTick(() => {
            this.scrollTop = 1e5;
          });
        }
      });
    }
    utils_socket.connectSocket(this.userId, (msg) => {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:134", "[WS] 收到消息:", msg);
    });
    utils_socket.onPrivateMessage((msg) => this.handleSocketMessage(msg));
    utils_socket.onGroupMessage((msg) => this.handleSocketMessage(msg));
    if (this.targetType === "group") {
      utils_socket.sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
    }
    setInterval(() => {
      this.connectionStatus = utils_socket.isConnected() ? "已连接" : "未连接";
    }, 1e3);
  },
  onUnload() {
    utils_socket.unregisterCmdHandler(2);
    utils_socket.unregisterCmdHandler(3);
  },
  methods: {
    /** 处理 socket 收到的消息 */
    handleSocketMessage(msg) {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:159", "进入 handleSocketMessage:", msg);
      if (msg.type === "private" && (msg.fromUser === this.targetId && msg.toUser === this.userId || msg.fromUser === this.userId && msg.toUser === this.targetId)) {
        const existingIdx = this.messages.findIndex((m) => m.msgId === msg.msgId);
        if (existingIdx !== -1) {
          this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg };
        } else {
          this.messages.push({ ...msg, isOffline: false, status: msg.status || "success" });
        }
        if (msg.fromUser !== this.userId) {
          this.collectUnreadMsgIds([msg.msgId]);
        }
        this.$nextTick(() => {
          this.scrollTop = 1e5;
        });
        return;
      }
      if (msg.type === "group") {
        const gid = msg.groupId;
        if (!gid)
          return;
        if (!this.groupMessages[gid])
          this.$set(this.groupMessages, gid, []);
        const exists = this.groupMessages[gid].some((m) => m.msgId === msg.msgId);
        if (!exists)
          this.groupMessages[gid].push({ ...msg, isOffline: false });
        if (this.targetType === "group" && this.targetId === gid) {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1];
            this.debounceSendGroupCursor(gid, last == null ? void 0 : last.msgId);
            this.scrollTop = 1e5;
          });
        }
      }
    },
    /** 发送消息 */
    sendMsg() {
      if (!this.inputMsg.trim())
        return;
      const msg = {
        msgId: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3),
        fromUser: this.userId,
        toUser: this.targetId,
        content: this.inputMsg,
        timestamp: Date.now(),
        type: this.targetType,
        status: "sending"
      };
      const onStatusChange = (status) => {
        msg.status = status;
        this.msgStatusMap[msg.msgId] = status;
      };
      if (this.targetType === "private") {
        utils_socket.sendMsg(msg, onStatusChange);
        this.messages.push(msg);
      } else {
        msg.groupId = this.targetId;
        utils_socket.sendGroupMsg(msg, onStatusChange);
        if (!this.groupMessages[this.targetId])
          this.$set(this.groupMessages, this.targetId, []);
        this.groupMessages[this.targetId].push(msg);
      }
      this.inputMsg = "";
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    },
    /** 已读回执 */
    handleReadAck(msgIds) {
      msgIds.forEach((msgId) => {
        const msg = this.messages.find((m) => m.msgId === msgId);
        if (msg && msg.fromUser === this.userId && msg.status === "success" && msg.type === "private") {
          msg.status = "isRead";
          this.msgStatusMap[msgId] = "isRead";
        }
      });
    },
    /** 收集未读消息 ID，延迟发送已读回执 */
    collectUnreadMsgIds(ids) {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:246", "收集未读ID:", ids);
      this.unreadMsgIdsBuffer.push(...ids);
      if (this.unreadMsgIdsTimer)
        clearTimeout(this.unreadMsgIdsTimer);
      this.unreadMsgIdsTimer = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBuffer));
        if (uniqueIds.length > 0)
          utils_socket.sendReadAck(uniqueIds);
        this.unreadMsgIdsBuffer = [];
        this.unreadMsgIdsTimer = null;
      }, 300);
    },
    /** 滚动加载群历史消息 */
    loadMoreMessages() {
      if (this.targetType !== "group" || !this.groupHasMore)
        return;
      const groupId = this.targetId;
      const pageNum = this.groupPageNum + 1;
      utils_socket.sendGroupHistoryRequest(groupId, pageNum, this.groupPageSize);
      this.groupPageNum = pageNum;
    },
    /** 工具方法 */
    disconnect() {
      utils_socket.closeSocket();
    },
    formatTimestamp(ts) {
      if (!ts)
        return "";
      let dateObj;
      if (typeof ts === "string") {
        if (ts.includes("-") && ts.includes(":") && ts.includes(" ")) {
          ts = ts.replace(/-/g, "/");
        }
        dateObj = new Date(ts);
      } else {
        dateObj = new Date(ts);
      }
      if (isNaN(dateObj.getTime()))
        return "";
      const h = String(dateObj.getHours()).padStart(2, "0");
      const m = String(dateObj.getMinutes()).padStart(2, "0");
      const s = String(dateObj.getSeconds()).padStart(2, "0");
      return `${h}:${m}:${s}`;
    },
    retrySend(msg) {
      msg.status = "sending";
      if (msg.type === "private")
        utils_socket.sendMsg(msg);
      else
        utils_socket.sendGroupMsg(msg);
    },
    /** 合并群聊历史 */
    mergeGroupHistory(arr) {
      arr.forEach((m) => {
        if (!this.groupMessages[m.groupId])
          this.$set(this.groupMessages, m.groupId, []);
        this.groupMessages[m.groupId].unshift(m);
      });
    },
    /** 防抖上报群游标 */
    debounceSendGroupCursor: /* @__PURE__ */ function() {
      let timer = null;
      return function(gid, msgId) {
        if (timer)
          clearTimeout(timer);
        timer = setTimeout(() => {
          utils_socket.sendGroupCursor(gid, msgId);
          timer = null;
        }, 500);
      };
    }()
  },
  computed: {
    currentMessages() {
      if (this.targetType === "private") {
        return this.messages.filter(
          (m) => m.fromUser === this.targetId && m.toUser === this.userId || m.fromUser === this.userId && m.toUser === this.targetId
        );
      } else {
        return this.groupMessages[this.targetId] || [];
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.currentTargetName),
    b: common_vendor.f($options.currentMessages, (item, index, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.nickname || item.fromUser),
        b: common_vendor.t(item.content),
        c: common_vendor.t($options.formatTimestamp(item.timestamp)),
        d: item.fromUser === $data.userId && item.type === "private"
      }, item.fromUser === $data.userId && item.type === "private" ? common_vendor.e({
        e: item.status === "sending"
      }, item.status === "sending" ? {} : item.status === "failed" ? {
        g: common_vendor.o(($event) => $options.retrySend(item), item.msgId || index)
      } : item.status === "success" ? {} : item.status === "isRead" ? {} : {}, {
        f: item.status === "failed",
        h: item.status === "success",
        i: item.status === "isRead"
      }) : {}, {
        j: item.msgId || index,
        k: common_vendor.n(item.fromUser === $data.userId ? "msg-sent" : "msg-received"),
        l: common_vendor.n(item.isOffline ? "offline-msg" : ""),
        m: common_vendor.n(item.status === "sending" ? "msg-sending" : ""),
        n: common_vendor.n(item.status === "failed" ? "msg-failed" : ""),
        o: common_vendor.n(item.status === "isRead" && item.fromUser === $data.userId && item.type === "private" ? "msg-isRead" : "")
      });
    }),
    c: $data.loadingHistory
  }, $data.loadingHistory ? {} : {}, {
    d: $data.scrollTop,
    e: common_vendor.o((...args) => $options.loadMoreMessages && $options.loadMoreMessages(...args)),
    f: $data.inputMsg,
    g: common_vendor.o(($event) => $data.inputMsg = $event.detail.value),
    h: common_vendor.o((...args) => $options.sendMsg && $options.sendMsg(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/chat.js.map
