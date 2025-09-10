"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const recorderManager = common_vendor.wx$1.getRecorderManager();
const _sfc_main = {
  data() {
    return {
      privateMessages: {},
      // { targetId: [msg1, msg2, ...] }
      groupMessages: {},
      // { groupId: [msg1, msg2, ...] }
      messageType: "text",
      recordStart: false,
      inputMsg: "",
      msgStatusMap: {},
      userId: "",
      targetId: "",
      targetType: "",
      currentTargetName: "",
      selfAvatar: common_vendor.index.getStorageSync("currentUserAvatar") || "",
      // 登录时存的头像 key
      friendAvatar: "",
      // 会在 onLoad 里根据 target 赋值
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
    common_vendor.index.__f__("log", "at pages/chat/chat.vue:157", "进入聊天页:", options);
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.selfAvatar = common_vendor.index.getStorageSync("currentUserAvatar") || this.selfAvatar || "/static/default-avatar/yang.png";
    this.targetId = options.targetId;
    this.targetType = options.type;
    this.currentTargetName = options.name || "";
    this.friendAvatar = options.avatar || this.friendAvatar || "/static/default-avatar/helanzhu.png";
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
    utils_socket.connectSocket(this.userId, (msg) => common_vendor.index.__f__("log", "at pages/chat/chat.vue:218", "[WS] 收到消息:", msg));
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
                status: "success",
                messageType: m.messageType || "text"
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
  onHide() {
    if (this._innerAudioContext) {
      this._innerAudioContext.stop();
    }
  },
  methods: {
    /** 处理 socket 收到的消息 */
    handleSocketMessage(msg) {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:316", "进入 handleSocketMessage:", msg);
      if (msg.type === "private") {
        const peerId = msg.fromUser === this.userId ? msg.toUser : msg.fromUser;
        if (!this.privateMessages[peerId])
          this.$set(this.privateMessages, peerId, []);
        const exists = this.privateMessages[peerId].some((m) => m.msgId === msg.msgId);
        if (!exists) {
          this.privateMessages[peerId].push({ ...msg, isOffline: false, status: msg.status || "success", messageType: msg.messageType || "text" });
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
          this.groupMessages[gid].push({ ...msg, isOffline: false, type: "group", messageType: msg.messageType || "text" });
        }
        if (this.targetType === "group" && this.targetId === gid) {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1];
            if (last == null ? void 0 : last.msgId)
              this.debounceSendGroupCursor(gid, last.msgId);
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
        status: "sending",
        messageType: "text"
        // text / image / voice
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
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:420", "收集未读ID:", ids, "for peer:", peerId);
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
    chooseImage() {
      common_vendor.index.chooseImage({
        // sourceType: 'album',
        success: (res) => {
          this.list.push({
            content: res.tempFilePaths[0],
            userType: "self",
            messageType: "image",
            avatar: this._selfAvatar
          });
          this.scrollToBottom();
          setTimeout(() => {
            this.list.push({
              content: "风景好漂亮啊~",
              userType: "friend",
              avatar: this._friendAvatar
            });
            this.scrollToBottom();
          }, 1500);
        }
      });
    },
    scrollToBottom() {
      this.top = this.list.length * 1e3;
    },
    msgClick(data) {
      if (data.messageType === "voice") {
        if (this._innerAudioContext) {
          this._innerAudioContext.stop();
          this._innerAudioContext.src = data.audioSrc;
          this._innerAudioContext.play();
          return;
        }
        this.play(data.audioSrc);
      }
    },
    authTips() {
      common_vendor.index.showModal({
        title: "提示",
        content: "您拒绝了麦克风权限，将导致功能不能正常使用，去设置权限？",
        confirmText: "去设置",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) {
            common_vendor.index.openSetting({
              success: (res2) => {
                if (res2.authSetting["scope.record"]) {
                  common_vendor.index.__f__("log", "at pages/chat/chat.vue:540", "已授权麦克风");
                  this._recordAuth = true;
                } else {
                  common_vendor.wx$1.showModal({
                    title: "提示",
                    content: "您未授权麦克风，功能将无法使用",
                    showCancel: false,
                    confirmText: "知道了"
                  });
                }
              }
            });
          }
        }
      });
    },
    touchstart() {
      const _permission = "scope.record";
      common_vendor.index.getSetting({
        success: (res) => {
          if (res.authSetting.hasOwnProperty(_permission)) {
            if (!res.authSetting[_permission]) {
              this.authTips();
            } else {
              this._recordAuth = true;
              recorderManager.start();
              recorderManager.onStart(() => {
                this.recordStart = true;
              });
              recorderManager.onError((res2) => {
                common_vendor.index.__f__("log", "at pages/chat/chat.vue:579", "recorder error", res2);
                common_vendor.index.showToast({
                  icon: "none",
                  title: "系统出错，请重试"
                });
                this.recordStart = false;
              });
            }
          } else {
            common_vendor.index.authorize({
              scope: _permission,
              success: () => {
                this._recordAuth = true;
              },
              fail: (res2) => {
                if (res2.error == 104) {
                  common_vendor.index.showModal({
                    title: "温馨提示",
                    content: "您拒绝了隐私协议，请稍后再试",
                    confirmText: "知道了",
                    showCancel: false,
                    success: () => {
                    }
                  });
                } else {
                  this.authTips();
                }
              }
            });
          }
        }
      });
    },
    touchend() {
      if (!this._recordAuth || !this.recordStart)
        return;
      recorderManager.stop();
      recorderManager.onStop((res) => {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:625", "结束录音", res);
        const { duration, tempFilePath } = res;
        this.recordStart = false;
        const peerId = this.targetId;
        if (!this.privateMessages[peerId])
          this.$set(this.privateMessages, peerId, []);
        const msg = {
          msgId: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3),
          fromUser: this.userId,
          toUser: peerId,
          content: `语音 ${Math.round(duration / 1e3)}''`,
          audioSrc: tempFilePath,
          timestamp: Date.now(),
          type: "private",
          messageType: "voice",
          status: "sending",
          // 默认 sending
          isOffline: false
        };
        this.privateMessages[peerId].push(msg);
        utils_socket.sendMsg(msg, (status) => {
          msg.status = status;
        });
        this.$nextTick(() => {
          this.scrollTop = 1e5;
        });
      });
    },
    //播放声音
    play(src) {
      this._innerAudioContext = common_vendor.wx$1.createInnerAudioContext();
      this._innerAudioContext.src = src;
      this._innerAudioContext.play();
      this._innerAudioContext.onPlay(() => {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:668", "开始播放");
      });
      this._innerAudioContext.onEnded(() => {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:672", "播放完毕");
      });
      this._innerAudioContext.onError((res) => {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:675", "audio play error", res);
      });
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
      const toInsert = Array.from(arr).reverse().filter((m) => m && m.msgId && !existed.has(m.msgId)).map((m) => ({
        ...m,
        messageType: m.messageType || "text",
        status: m.status || "success"
      }));
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
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:727", "[mergeGroupHistory] 进入, arr:", arr);
      const gid = this.targetId;
      if (!this.groupMessages[gid] || !Array.isArray(this.groupMessages[gid])) {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:730", "[mergeGroupHistory] 初始化 groupMessages[gid]");
        this.$set(this.groupMessages, gid, []);
      }
      const existed = new Set(this.groupMessages[gid].map((m) => m.msgId));
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:735", "[mergeGroupHistory] 已有消息 ID:", existed);
      arr.forEach((m) => {
        if (m && m.msgId && !existed.has(m.msgId)) {
          common_vendor.index.__f__("log", "at pages/chat/chat.vue:739", "[mergeGroupHistory] 插入新消息:", m);
          this.groupMessages[gid].unshift({
            ...m,
            type: "group",
            messageType: m.messageType || "text",
            status: m.status || "success",
            isOffline: m.isOffline || false
          });
        } else {
          common_vendor.index.__f__("log", "at pages/chat/chat.vue:749", "[mergeGroupHistory] 跳过重复或非法消息:", m);
        }
      });
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:752", "[mergeGroupHistory] 最终 groupMessages[gid]:", this.groupMessages[gid]);
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
    a: common_vendor.f($options.currentMessages, (item, index, i0) => {
      return common_vendor.e({
        a: item.fromUser !== $data.userId
      }, item.fromUser !== $data.userId ? {
        b: item.avatar || $data.friendAvatar
      } : {}, {
        c: item.fromUser === $data.userId && item.type === "private"
      }, item.fromUser === $data.userId && item.type === "private" ? common_vendor.e({
        d: item.status === "sending"
      }, item.status === "sending" ? {} : item.status === "failed" ? {} : item.status === "success" ? {} : item.status === "isRead" ? {} : {}, {
        e: item.status === "failed",
        f: item.status === "success",
        g: item.status === "isRead"
      }) : {}, {
        h: item.messageType === "text"
      }, item.messageType === "text" ? {
        i: common_vendor.t(item.content),
        j: common_vendor.t($options.formatTimestamp(item.timestamp))
      } : item.messageType === "image" ? {
        l: item.content,
        m: common_vendor.o(($event) => _ctx.previewImage(item.content), item.msgId || index)
      } : item.messageType === "voice" ? {
        o: common_vendor.t(item.content || "播放语音")
      } : {}, {
        k: item.messageType === "image",
        n: item.messageType === "voice",
        p: item.fromUser === $data.userId
      }, item.fromUser === $data.userId ? {
        q: item.avatar || $data.selfAvatar
      } : {}, {
        r: item.msgId || index,
        s: common_vendor.n(item.fromUser === $data.userId ? "self" : "friend"),
        t: common_vendor.o(($event) => $options.msgClick(item), item.msgId || index)
      });
    }),
    b: $data.loadingHistory
  }, $data.loadingHistory ? {} : {}, {
    c: $data.scrollTop,
    d: common_vendor.o((...args) => $options.loadMoreMessages && $options.loadMoreMessages(...args)),
    e: $data.messageType === "text"
  }, $data.messageType === "text" ? {
    f: common_assets._imports_0,
    g: common_vendor.o(($event) => $data.messageType = "voice"),
    h: common_vendor.o((...args) => $options.sendMsg && $options.sendMsg(...args)),
    i: $data.inputMsg,
    j: common_vendor.o(($event) => $data.inputMsg = $event.detail.value),
    k: common_assets._imports_1,
    l: common_vendor.o((...args) => $options.chooseImage && $options.chooseImage(...args))
  } : $data.messageType === "voice" ? {
    n: common_assets._imports_2,
    o: common_vendor.o(($event) => $data.messageType = "text"),
    p: common_vendor.t($data.recordStart ? "松开 发送" : "按住 说话"),
    q: common_vendor.o((...args) => $options.touchstart && $options.touchstart(...args)),
    r: common_vendor.o((...args) => $options.touchend && $options.touchend(...args))
  } : {}, {
    m: $data.messageType === "voice",
    s: $data.recordStart
  }, $data.recordStart ? {
    t: common_vendor.f(10, (item, k0, i0) => {
      return {
        a: `${item / 10}s`
      };
    })
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-0a633310"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/chat.js.map
