"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      privateMessages: {},
      // { targetId: [msg1, msg2, ...] }
      groupMessages: {},
      // { groupId: [msg1, msg2, ...] }
      inputMsg: "",
      msgStatusMap: {},
      userId: "",
      targetId: "",
      targetType: "",
      currentTargetName: "",
      currentTargetAvatar: "",
      connectionStatus: "未连接",
      scrollTop: 0,
      groupPageNum: 1,
      groupPageSize: 20,
      groupHasMore: true,
      loadingHistory: false,
      unreadMsgIdsBuffer: [],
      unreadMsgIdsTimer: null
    };
  },
  computed: {
    currentMessages() {
      if (this.targetType === "private") {
        return this.privateMessages[this.targetId] || [];
      } else if (this.targetType === "group") {
        return this.groupMessages[this.targetId] || [];
      }
      return [];
    }
  },
  onLoad(options) {
    common_vendor.index.__f__("log", "at pages/chat/chat.vue:107", "进入聊天页:", options);
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.targetId = options.targetId;
    this.targetType = options.type;
    this.currentTargetName = options.name || "";
    this.currentTargetAvatar = options.avatar || "";
    if (this.targetType === "private")
      this.$set(this.privateMessages, this.targetId, []);
    if (this.targetType === "group")
      this.$set(this.groupMessages, this.targetId, []);
    utils_socket.setReadAckHandler((msgIds) => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]));
    utils_socket.setGroupHistoryHandler((arr) => {
      this.loadingHistory = false;
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    });
    utils_socket.setReplayGroupHistoryHandler((arr) => {
      if (!Array.isArray(arr) || arr.length === 0)
        return;
      this.mergeGroupHistory(arr);
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    });
    utils_socket.connectSocket(this.userId, (msg) => common_vendor.index.__f__("log", "at pages/chat/chat.vue:142", "[WS] 收到消息:", msg));
    utils_socket.onPrivateMessage((msg) => this.handleSocketMessage(msg));
    utils_socket.onGroupMessage((msg) => this.handleSocketMessage(msg));
    if (this.targetType === "private") {
      utils_socket.fetchOfflinePrivateMessages(this.targetId, (offlineMsgs) => {
        if (Array.isArray(offlineMsgs)) {
          this.$set(this.privateMessages, this.targetId, offlineMsgs.map((m) => ({ ...m, isOffline: true, status: "success" })));
          const unreadIds = offlineMsgs.filter((m) => m.fromUser === this.targetId).map((m) => m.msgId);
          if (unreadIds.length > 0)
            this.collectUnreadMsgIds(unreadIds, this.targetId);
          this.$nextTick(() => {
            this.scrollTop = 1e5;
          });
        }
      });
    }
    if (this.targetType === "group") {
      this.groupPageNum = 1;
      this.groupHasMore = true;
      this.loadingHistory = true;
      utils_socket.sendReplayGroupHistoryRequest(this.targetId);
      utils_socket.sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
    }
    this.connTimer = setInterval(() => {
      this.connectionStatus = utils_socket.isConnected() ? "已连接" : "未连接";
    }, 1e3);
  },
  onUnload() {
    common_vendor.index.$emit("clearUnread", {
      sessionId: this.targetId,
      type: this.targetType
    });
    utils_socket.unregisterCmdHandler(2);
    utils_socket.unregisterCmdHandler(3);
    utils_socket.unregisterCmdHandler(103);
    utils_socket.setGroupHistoryHandler(null);
    clearInterval(this.connTimer);
    utils_socket.unregisterCmdHandler(104);
    utils_socket.setReplayGroupHistoryHandler(null);
  },
  methods: {
    /** 处理 socket 收到的消息 */
    handleSocketMessage(msg) {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:192", "进入 handleSocketMessage:", msg);
      if (msg.type === "private") {
        const peerId = msg.fromUser === this.userId ? msg.toUser : msg.fromUser;
        if (!this.privateMessages[peerId])
          this.$set(this.privateMessages, peerId, []);
        const exists = this.privateMessages[peerId].some((m) => m.msgId === msg.msgId);
        if (!exists) {
          this.privateMessages[peerId].push({ ...msg, isOffline: false, status: msg.status || "success" });
        }
        if (peerId === this.targetId) {
          this.$nextTick(() => {
            this.scrollTop = 1e5;
          });
        }
        if (msg.fromUser !== this.userId) {
          this.collectUnreadMsgIds([msg.msgId], peerId);
        }
        common_vendor.index.$emit("refreshSessions");
        return;
      }
      if (msg.type === "group") {
        const gid = msg.groupId;
        if (!this.groupMessages[gid])
          this.$set(this.groupMessages, gid, []);
        const existed = this.groupMessages[gid].some((m) => m.msgId === msg.msgId);
        if (!existed) {
          this.groupMessages[gid].push({ ...msg, isOffline: false, type: "group" });
        }
        if (this.targetType === "group" && this.targetId === gid) {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1];
            if (last == null ? void 0 : last.msgId)
              this.debounceSendGroupCursor(gid, last.msgId);
            this.scrollTop = 1e5;
          });
        }
        common_vendor.index.$emit("refreshSessions");
        return;
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
        if (!this.privateMessages[this.targetId])
          this.$set(this.privateMessages, this.targetId, []);
        this.privateMessages[this.targetId].push(msg);
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
      common_vendor.index.$emit("refreshSessions");
    },
    /** 已读回执 */
    handleReadAck(msgIds) {
      msgIds.forEach((msgId) => {
        for (const msgs of Object.values(this.privateMessages)) {
          const msg = msgs.find((m) => m.msgId === msgId);
          if (msg && msg.fromUser === this.userId && msg.status === "success" && msg.type === "private") {
            msg.status = "isRead";
            this.msgStatusMap[msgId] = "isRead";
          }
        }
      });
    },
    /** 收集未读消息 ID，延迟发送已读回执 */
    collectUnreadMsgIds(ids, peerId) {
      if (!peerId)
        return;
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:301", "收集未读ID:", ids, "for peer:", peerId);
      if (!this.unreadMsgIdsBufferMap)
        this.unreadMsgIdsBufferMap = {};
      if (!this.unreadMsgIdsBufferMap[peerId])
        this.unreadMsgIdsBufferMap[peerId] = [];
      this.unreadMsgIdsBufferMap[peerId].push(...ids);
      if (this.unreadMsgIdsTimerMap && this.unreadMsgIdsTimerMap[peerId]) {
        clearTimeout(this.unreadMsgIdsTimerMap[peerId]);
      } else if (!this.unreadMsgIdsTimerMap) {
        this.unreadMsgIdsTimerMap = {};
      }
      this.unreadMsgIdsTimerMap[peerId] = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBufferMap[peerId]));
        if (uniqueIds.length > 0)
          utils_socket.sendReadAck(uniqueIds, peerId);
        this.unreadMsgIdsBufferMap[peerId] = [];
        this.unreadMsgIdsTimerMap[peerId] = null;
      }, 300);
    },
    /** 滚动加载群历史消息 */
    loadMoreMessages() {
      if (this.targetType !== "group" || !this.groupHasMore || this.loadingHistory)
        return;
      this.loadingHistory = true;
      this.groupPageNum += 1;
      utils_socket.sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
    },
    /** 工具方法 */
    disconnect() {
      closeSocket();
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
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:360", "[mergeGroupHistory] 进入, arr:", arr);
      const gid = this.targetId;
      if (!this.groupMessages[gid] || !Array.isArray(this.groupMessages[gid])) {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:363", "[mergeGroupHistory] 初始化 groupMessages[gid]");
        this.$set(this.groupMessages, gid, []);
      }
      const existed = new Set(this.groupMessages[gid].map((m) => m.msgId));
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:368", "[mergeGroupHistory] 已有消息 ID:", existed);
      arr.forEach((m) => {
        if (m && m.msgId && !existed.has(m.msgId)) {
          common_vendor.index.__f__("log", "at pages/chat/chat.vue:372", "[mergeGroupHistory] 插入新消息:", m);
          this.groupMessages[gid].unshift(m);
        } else {
          common_vendor.index.__f__("log", "at pages/chat/chat.vue:376", "[mergeGroupHistory] 跳过重复或非法消息:", m);
        }
      });
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:379", "[mergeGroupHistory] 最终 groupMessages[gid]:", this.groupMessages[gid]);
      this.loadingHistory = false;
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
