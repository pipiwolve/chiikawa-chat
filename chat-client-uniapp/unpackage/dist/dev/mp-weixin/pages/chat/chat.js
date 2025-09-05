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
      unreadMsgIdsTimer: null,
      privatePageNum: 1,
      privatePageSize: 50,
      privateHasMore: true,
      loadingPrivateHistory: false
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
    common_vendor.index.__f__("log", "at pages/chat/chat.vue:114", "进入聊天页:", options);
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.targetId = options.targetId;
    this.targetType = options.type;
    this.currentTargetName = options.name || "";
    this.currentTargetAvatar = options.avatar || "";
    if (this.targetType === "private")
      this.$set(this.privateMessages, this.targetId, []);
    if (this.targetType === "group")
      this.$set(this.groupMessages, this.targetId, []);
    utils_socket.setGroupHistoryHandler((arr) => {
      this.loadingHistory = false;
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
      this.$nextTick(() => {
        this.scrollTop = 1e5;
        const last = this.groupMessages[this.targetId][this.groupMessages[this.targetId].length - 1];
        if (last == null ? void 0 : last.msgId)
          this.debounceSendGroupCursor(this.targetId, last.msgId);
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
    utils_socket.setPrivateHistoryHandler((arr) => {
      this.loadingPrivateHistory = false;
      if (!Array.isArray(arr) || arr.length === 0) {
        if (this.privatePageNum === 1)
          this.privateHasMore = false;
        return;
      }
      this.mergePrivateHistory(arr);
      const peerId = this.targetId;
      const unreadIds = arr.filter((m) => m.fromUser === peerId && !m.isRead).map((m) => m.msgId);
      if (unreadIds.length > 0)
        this.collectUnreadMsgIds(unreadIds, peerId);
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    });
    utils_socket.setReadAckHandler((msgIds) => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]));
    utils_socket.connectSocket(this.userId, (msg) => common_vendor.index.__f__("log", "at pages/chat/chat.vue:174", "[WS] 收到消息:", msg));
    utils_socket.onPrivateMessage((msg) => this.handleSocketMessage(msg));
    utils_socket.onGroupMessage((msg) => this.handleSocketMessage(msg));
    if (this.targetType === "private") {
      this.privatePageNum = 1;
      this.privateHasMore = true;
      this.loadingPrivateHistory = true;
      utils_socket.sendPrivateHistoryRequest(this.targetId, this.privatePageNum, this.privatePageSize);
      setTimeout(() => {
        utils_socket.fetchOfflinePrivateMessages(this.targetId, (offlineMsgs) => {
          if (Array.isArray(offlineMsgs) && offlineMsgs.length > 0) {
            if (!this.privateMessages[this.targetId]) {
              this.$set(this.privateMessages, this.targetId, []);
            }
            offlineMsgs.sort((a, b) => a.timestamp - b.timestamp);
            offlineMsgs.forEach((m) => {
              this.privateMessages[this.targetId].push({
                ...m,
                isOffline: true,
                status: "success"
              });
            });
            const unreadIds = offlineMsgs.filter((m) => m.fromUser === this.targetId).map((m) => m.msgId);
            if (unreadIds.length > 0)
              this.collectUnreadMsgIds(unreadIds, this.targetId);
            this.$nextTick(() => {
              this.scrollTop = 1e5;
            });
          }
        });
      }, 200);
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
    if (this.targetType === "group") {
      const msgs = this.groupMessages[this.targetId] || [];
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (last == null ? void 0 : last.msgId)
          utils_socket.sendGroupCursor(this.targetId, last.msgId);
      }
    }
    common_vendor.index.$emit("clearUnread", {
      sessionId: this.targetId,
      type: this.targetType
    });
    utils_socket.unregisterCmdHandler(2, this.handleSocketMessage);
    utils_socket.unregisterCmdHandler(3, this.handleSocketMessage);
    utils_socket.unregisterCmdHandler(103);
    utils_socket.unregisterCmdHandler(105);
    utils_socket.setGroupHistoryHandler(null);
    utils_socket.setPrivateHistoryHandler && utils_socket.setPrivateHistoryHandler(null);
    clearInterval(this.connTimer);
    utils_socket.unregisterCmdHandler(104);
    utils_socket.setReplayGroupHistoryHandler(null);
  },
  methods: {
    /** 处理 socket 收到的消息 */
    handleSocketMessage(msg) {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:268", "进入 handleSocketMessage:", msg);
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
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:373", "收集未读ID:", ids, "for peer:", peerId);
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
    // 滚动加载私聊（在 scroll 至顶触发）
    loadMoreMessages() {
      if (this.targetType === "group") {
        if (!this.groupHasMore || this.loadingHistory)
          return;
        this.loadingHistory = true;
        this.groupPageNum += 1;
        utils_socket.sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
        return;
      }
      if (this.targetType === "private") {
        if (!this.privateHasMore || this.loadingPrivateHistory)
          return;
        this.loadingPrivateHistory = true;
        this.privatePageNum += 1;
        utils_socket.sendPrivateHistoryRequest(this.targetId, this.privatePageNum, this.privatePageSize);
        return;
      }
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
    /** 合并私聊历史（把更早的消息放在数组前面） */
    mergePrivateHistory(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.loadingPrivateHistory = false;
        return;
      }
      const peerId = this.targetId;
      if (!this.privateMessages[peerId] || !Array.isArray(this.privateMessages[peerId])) {
        this.$set(this.privateMessages, peerId, []);
      }
      const existed = new Set(this.privateMessages[peerId].map((m) => m.msgId));
      const toInsert = Array.from(arr).reverse().filter((m) => m && m.msgId && !existed.has(m.msgId));
      this.privateMessages[peerId] = toInsert.concat(this.privateMessages[peerId]);
      if (arr.length < this.privatePageSize) {
        this.privateHasMore = false;
      }
      this.loadingPrivateHistory = false;
      const msgs = this.privateMessages[peerId];
      if (Array.isArray(msgs)) {
        msgs.forEach((m) => {
          if (m.fromUser === this.userId) {
            m.status = m.isRead ? "isRead" : m.status || "success";
          } else {
            m.status = m.status || "success";
          }
        });
      }
    },
    /** 合并群聊历史 */
    mergeGroupHistory(arr) {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:485", "[mergeGroupHistory] 进入, arr:", arr);
      const gid = this.targetId;
      if (!this.groupMessages[gid] || !Array.isArray(this.groupMessages[gid])) {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:488", "[mergeGroupHistory] 初始化 groupMessages[gid]");
        this.$set(this.groupMessages, gid, []);
      }
      const existed = new Set(this.groupMessages[gid].map((m) => m.msgId));
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:493", "[mergeGroupHistory] 已有消息 ID:", existed);
      arr.forEach((m) => {
        if (m && m.msgId && !existed.has(m.msgId)) {
          common_vendor.index.__f__("log", "at pages/chat/chat.vue:497", "[mergeGroupHistory] 插入新消息:", m);
          this.groupMessages[gid].unshift(m);
        } else {
          common_vendor.index.__f__("log", "at pages/chat/chat.vue:501", "[mergeGroupHistory] 跳过重复或非法消息:", m);
        }
      });
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:504", "[mergeGroupHistory] 最终 groupMessages[gid]:", this.groupMessages[gid]);
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
