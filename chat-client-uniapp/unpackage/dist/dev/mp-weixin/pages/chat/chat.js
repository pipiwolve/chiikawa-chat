"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const ContactList = () => "../../components/ContactList.js";
const GroupList = () => "../../components/GroupList.js";
const _sfc_main = {
  components: { ContactList, GroupList },
  data() {
    return {
      messages: [],
      inputMsg: "",
      userId: "",
      targetId: "",
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
      unreadMsgIdsTimer: null
    };
  },
  onLoad(options) {
    var _a;
    this.userId = options.userId || "user1";
    this.targetId = ((_a = this.contacts.concat(this.groups).find((c) => c.id !== this.userId)) == null ? void 0 : _a.id) || "";
    this.connectionStatus = "连接中...";
    utils_socket.setReadAckHandler((msgIds) => {
      const list = Array.isArray(msgIds) ? msgIds : [msgIds];
      this.handleReadAck(list);
    });
    utils_socket.connectSocket(this.userId, (msg) => {
      if (Array.isArray(msg)) {
        const offlineMsgs = msg.map((m) => ({ ...m, isOffline: true, status: null }));
        this.messages.push(...offlineMsgs);
        const unreadOfflineMsgs = offlineMsgs.filter((m) => m.fromUser !== this.userId && m.fromUser === this.targetId);
        const unreadMsgIds = unreadOfflineMsgs.map((m) => m.msgId).filter((id) => !!id);
        if (unreadMsgIds.length > 0)
          this.collectUnreadMsgIds(unreadMsgIds);
        this.$nextTick(() => {
          this.scrollTop = 1e5;
        });
      } else {
        const existingIdx = this.messages.findIndex((m) => m.msgId === msg.msgId);
        if (existingIdx !== -1) {
          this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg };
        } else {
          this.messages.push({ ...msg, isOffline: false, status: null });
        }
        if (msg.msgId && msg.fromUser !== this.userId && msg.fromUser === this.targetId) {
          this.collectUnreadMsgIds([msg.msgId]);
        }
        this.$nextTick(() => {
          this.scrollTop = 1e5;
        });
      }
    });
    setInterval(() => {
      const status = utils_socket.isConnected() ? "已连接" : "未连接";
      this.connectionStatus = status;
    }, 1e3);
  },
  onUnload() {
    utils_socket.setReadAckHandler(null);
    if (this.unreadMsgIdsTimer) {
      clearTimeout(this.unreadMsgIdsTimer);
      this.unreadMsgIdsTimer = null;
    }
  },
  methods: {
    sendMsg() {
      if (!this.inputMsg)
        return;
      const target = this.contacts.concat(this.groups).find((c) => c.id === this.targetId);
      if (!target) {
        common_vendor.index.showToast({ title: "请选择联系人或群组", icon: "none" });
        return;
      }
      const msgId = "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1e4);
      const newMsg = {
        msgId,
        fromUser: this.userId,
        toUser: this.targetId,
        content: this.inputMsg,
        status: "sending",
        isOffline: false,
        timestamp: Date.now(),
        type: target.type,
        nickname: (this.contacts.find((c) => c.id === this.userId) || {}).name || this.userId
      };
      this.messages.push(newMsg);
      const onStatusChange = (status) => {
        this.msgStatusMap[msgId] = status;
        newMsg.status = status;
      };
      if (target.type === "user") {
        utils_socket.sendMsg(this.targetId, this.inputMsg, this.userId, onStatusChange, msgId);
      } else if (target.type === "group") {
        utils_socket.sendGroupMsg(this.targetId, this.inputMsg, this.userId, onStatusChange, msgId);
      }
      this.inputMsg = "";
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    },
    handleSelectUser(id) {
      const pendingIds = this.messages.filter((m) => m.fromUser !== this.userId && m.toUser === this.targetId).map((m) => m.msgId).filter(Boolean);
      if (pendingIds.length)
        utils_socket.sendReadAck(pendingIds);
      this.targetId = id;
      this.messages = [];
    },
    loadMoreMessages() {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:186", "滚动到底部，加载更多消息");
    },
    handleReadAck(msgIds) {
      msgIds.forEach((msgId) => {
        const msg = this.messages.find((m) => m.msgId === msgId);
        if (msg && msg.fromUser === this.userId && msg.status === "success") {
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
    disconnect() {
      utils_socket.closeSocket();
    },
    formatTimestamp(ts) {
      if (!ts)
        return "";
      const date = new Date(ts);
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    },
    retrySend(msg) {
      if (!msg.msgId)
        return;
      msg.status = "sending";
      this.msgStatusMap[msg.msgId] = "sending";
      const onStatusChange = (status) => {
        this.msgStatusMap[msg.msgId] = status;
        msg.status = status;
      };
      if (msg.type === "user") {
        utils_socket.sendMsg(msg.toUser, msg.content, msg.fromUser, onStatusChange);
      } else if (msg.type === "group") {
        utils_socket.sendGroupMsg(msg.toUser, msg.content, msg.fromUser, onStatusChange);
      }
    }
  }
};
if (!Array) {
  const _component_ContactList = common_vendor.resolveComponent("ContactList");
  const _component_GroupList = common_vendor.resolveComponent("GroupList");
  (_component_ContactList + _component_GroupList)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o($options.handleSelectUser),
    b: common_vendor.p({
      users: $data.contacts,
      selectedUserId: $data.targetId
    }),
    c: common_vendor.o($options.handleSelectUser),
    d: common_vendor.p({
      groups: $data.groups,
      selectedGroupId: $data.targetId
    }),
    e: common_vendor.f($data.messages, (item, index, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.nickname || item.fromUser),
        b: common_vendor.t(item.content),
        c: common_vendor.t($options.formatTimestamp(item.timestamp)),
        d: item.fromUser === $data.userId
      }, item.fromUser === $data.userId ? common_vendor.e({
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
        o: common_vendor.n(item.status === "isRead" && item.fromUser === $data.userId ? "msg-isRead" : "")
      });
    }),
    f: $data.scrollTop,
    g: common_vendor.o((...args) => $options.loadMoreMessages && $options.loadMoreMessages(...args)),
    h: $data.inputMsg,
    i: common_vendor.o(($event) => $data.inputMsg = $event.detail.value),
    j: common_vendor.o((...args) => $options.sendMsg && $options.sendMsg(...args)),
    k: common_vendor.o((...args) => $options.disconnect && $options.disconnect(...args)),
    l: common_vendor.t($data.connectionStatus)
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/chat.js.map
