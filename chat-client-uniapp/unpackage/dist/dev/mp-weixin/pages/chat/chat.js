"use strict";
const utils_socket = require("../../utils/socket.js");
const common_vendor = require("../../common/vendor.js");
const ContactList = () => "../../components/ContactList.js";
const GroupList = () => "../../components/GroupList.js";
const _sfc_main = {
  components: { ContactList, GroupList },
  data() {
    return {
      messages: [],
      groupMessages: {},
      unreadGroupCount: {},
      inputMsg: "",
      userId: "",
      targetId: "",
      targetType: "",
      contacts: [
        { id: "user1", name: "用户一", type: "user" },
        { id: "user2", name: "用户二", type: "user" }
      ],
      groups: [
        { id: "group1", name: "群聊1", type: "group" },
        { id: "group2", name: "群聊2", type: "group" }
      ],
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
  computed: {
    currentMessages() {
      return this.targetType === "private" ? this.messages : this.groupMessages[this.targetId] || [];
    },
    currentTargetName() {
      const contact = this.contacts.find((c) => c.id === this.targetId);
      if (contact)
        return contact.name;
      const group = this.groups.find((g) => g.id === this.targetId);
      return group ? group.name : "";
    }
  },
  onLoad(options) {
    this.userId = options.userId || "";
    this.connectionStatus = "连接中...";
    utils_socket.setReadAckHandler((msgIds) => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]));
    utils_socket.setGroupHistoryHandler((arr) => {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
    });
    utils_socket.connectSocket(this.userId, (msg) => this.handleSocketMessage(msg));
    setInterval(() => {
      this.connectionStatus = utils_socket.isConnected() ? "已连接" : "未连接";
    }, 1e3);
  },
  methods: {
    handleSocketMessage(msg) {
      if (msg.cmd === 10) {
        this.statusMsg = msg.result === "ok" ? "注册成功，请登录" : "注册失败";
        return;
      }
      if (msg.cmd === 11) {
        if (msg.result === "ok") {
          this.userId = msg.fromUser || this.userId;
          this.statusMsg = "登录成功";
          const firstContact = this.contacts.find((c) => c.id !== this.userId);
          this.targetId = firstContact ? firstContact.id : "";
          this.targetType = this.contacts.find((c) => c.id === this.targetId) ? "private" : "group";
          if (this.targetType === "group" && !this.groupMessages[this.targetId]) {
            this.$set(this.groupMessages, this.targetId, []);
          }
          if (this.targetType === "group") {
            utils_socket.sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
          }
          this.initOfflineMessages();
        } else {
          this.statusMsg = "登录失败";
        }
        return;
      }
      this.processMessage(msg);
    },
    initOfflineMessages() {
      utils_socket.sendReadAck([]);
    },
    processMessage(msg) {
      if (Array.isArray(msg)) {
        const offlineMsgs = msg.map((m) => ({ ...m, isOffline: true, status: null }));
        this.messages.push(...offlineMsgs);
        const unreadIds = offlineMsgs.filter((m) => m.fromUser !== this.userId).map((m) => m.msgId).filter(Boolean);
        if (unreadIds.length > 0)
          this.collectUnreadMsgIds(unreadIds);
        this.$nextTick(() => {
          this.scrollTop = 1e5;
        });
        return;
      }
      if (msg.cmd === 3) {
        const gid = msg.groupId;
        if (!gid)
          return;
        if (!this.groupMessages[gid])
          this.$set(this.groupMessages, gid, []);
        const exists = this.groupMessages[gid].some((m) => m.msgId === msg.msgId);
        if (!exists)
          this.groupMessages[gid].push({ ...msg, isOffline: false });
        if (this.targetType !== "group" || this.targetId !== gid) {
          this.$set(this.unreadGroupCount, gid, (this.unreadGroupCount[gid] || 0) + 1);
        } else {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1];
            this.debounceSendGroupCursor(gid, last == null ? void 0 : last.msgId);
            this.scrollTop = 1e5;
          });
        }
        return;
      }
      const existingIdx = this.messages.findIndex((m) => m.msgId === msg.msgId);
      if (existingIdx !== -1) {
        this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg };
      } else {
        this.messages.push({ ...msg, isOffline: false, status: null });
      }
      if (msg.msgId && msg.fromUser !== this.userId && msg.type === "private" && msg.fromUser === this.targetId) {
        this.collectUnreadMsgIds([msg.msgId]);
      }
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    },
    sendMsg() {
      if (!this.inputMsg.trim())
        return;
      const msg = {
        msgId: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3),
        fromUser: this.userId,
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
        msg.toUser = this.targetId;
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
    handleSelectUser(id) {
      this.targetId = id;
      this.targetType = "private";
    },
    handleSelectGroup(gid) {
      this.targetId = gid;
      this.targetType = "group";
      this.unreadGroupCount[gid] = 0;
    },
    handleReadAck(msgIds) {
      msgIds.forEach((msgId) => {
        const msg = this.messages.find((m) => m.msgId === msgId);
        if (msg && msg.fromUser === this.userId && msg.status === "success" && msg.type === "private") {
          msg.status = "isRead";
          this.msgStatusMap[msgId] = "isRead";
        }
      });
    },
    collectUnreadMsgIds(ids) {
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
    // 滚动加载历史消息
    loadMoreMessages() {
      if (this.targetType !== "group" || !this.groupHasMore)
        return;
      const groupId = this.targetId;
      const pageNum = this.groupPageNum + 1;
      utils_socket.sendGroupHistoryRequest(groupId, pageNum, this.groupPageSize);
      this.groupPageNum = pageNum;
    },
    disconnect() {
      utils_socket.closeSocket();
    },
    formatTimestamp(ts) {
      const d = new Date(ts);
      return d.toLocaleTimeString();
    },
    retrySend(msg) {
      msg.status = "sending";
      if (msg.type === "private") {
        utils_socket.sendMsg(msg);
      } else {
        utils_socket.sendGroupMsg(msg);
      }
    },
    // 合并群聊历史
    mergeGroupHistory(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      arr.forEach((m) => {
        if (!this.groupMessages[m.groupId])
          this.$set(this.groupMessages, m.groupId, []);
        this.groupMessages[m.groupId].unshift(m);
      });
    },
    // 防抖上报群游标
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
if (!Array) {
  const _component_ContactList = common_vendor.resolveComponent("ContactList");
  const _component_GroupList = common_vendor.resolveComponent("GroupList");
  (_component_ContactList + _component_GroupList)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o($options.handleSelectUser),
    b: common_vendor.p({
      users: $data.contacts,
      selectedUserId: $data.targetId
    }),
    c: common_vendor.o($options.handleSelectGroup),
    d: common_vendor.p({
      groups: $data.groups,
      selectedGroupId: $data.targetId
    }),
    e: common_vendor.t($options.currentTargetName),
    f: common_vendor.f($options.currentMessages, (item, index, i0) => {
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
    g: $data.loadingHistory
  }, $data.loadingHistory ? {} : {}, {
    h: $data.scrollTop,
    i: common_vendor.o((...args) => $options.loadMoreMessages && $options.loadMoreMessages(...args)),
    j: $data.inputMsg,
    k: common_vendor.o(($event) => $data.inputMsg = $event.detail.value),
    l: common_vendor.o((...args) => $options.sendMsg && $options.sendMsg(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/chat.js.map
