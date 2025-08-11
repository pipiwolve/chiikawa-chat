"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const ContactList = () => "../../components/ContactList.js";
const GroupList = () => "../../components/GroupList.js";
const _sfc_main = {
  components: {
    ContactList,
    GroupList
  },
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
      scrollTop: 0
      // 用于消息滚动控制
    };
  },
  onLoad(options) {
    var _a;
    this.userId = options.userId || "user1";
    common_vendor.index.__f__("log", "at pages/chat/chat.vue:81", "[页面加载] 当前用户ID:", this.userId);
    this.targetId = ((_a = this.contacts.concat(this.groups).find((c) => c.id !== this.userId)) == null ? void 0 : _a.id) || "";
    this.connectionStatus = "连接中...";
    utils_socket.connectSocket(this.userId, (msg) => {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:87", "[WebSocket] 收到消息:", msg);
      if (Array.isArray(msg)) {
        this.messages.push(...msg);
      } else {
        this.messages.push(msg);
      }
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    });
    setInterval(() => {
      const status = utils_socket.isConnected() ? "已连接" : "未连接";
      if (this.connectionStatus !== status) {
        common_vendor.index.__f__("log", "at pages/chat/chat.vue:107", "[连接状态] 状态变化:", status);
      }
      this.connectionStatus = status;
    }, 1e3);
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
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:122", "[发送] 目标:", this.targetId, "消息:", this.inputMsg);
      if (target.type === "user") {
        utils_socket.sendMsg(this.targetId, this.inputMsg, this.userId);
      } else if (target.type === "group") {
        utils_socket.sendGroupMsg(this.targetId, this.inputMsg, this.userId);
      }
      this.messages.push({
        cmd: target.type === "user" ? 2 : 3,
        type: target.type,
        from: this.userId,
        to: this.targetId,
        message: this.inputMsg,
        timestamp: (/* @__PURE__ */ new Date()).getTime()
      });
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:140", "[发送] 本地消息列表长度:", this.messages.length);
      this.inputMsg = "";
      this.$nextTick(() => {
        this.scrollTop = 1e5;
      });
    },
    handleSelectUser(id) {
      this.targetId = id;
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:151", "[切换聊天对象] 目标ID:", id);
      this.messages = [];
    },
    loadMoreMessages() {
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:158", "滚动到底部，加载更多消息");
    },
    // 关闭连接操作
    disconnect() {
      utils_socket.closeSocket();
      common_vendor.index.__f__("log", "at pages/chat/chat.vue:164", "手动断开 WebSocket 连接");
    },
    formatTimestamp(ts) {
      if (!ts)
        return "";
      const date = new Date(ts);
      const h = date.getHours().toString().padStart(2, "0");
      const m = date.getMinutes().toString().padStart(2, "0");
      return `${h}:${m}`;
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
        a: common_vendor.t(item.nickname || item.from),
        b: common_vendor.t(item.message),
        c: common_vendor.t($options.formatTimestamp(item.timestamp)),
        d: item.from === $data.userId
      }, item.from === $data.userId ? common_vendor.e({
        e: item.status === "sending"
      }, item.status === "sending" ? {} : {}, {
        f: item.status === "failed"
      }, item.status === "failed" ? {
        g: common_vendor.o(($event) => _ctx.retrySend(index), index)
      } : {}) : {}, {
        h: index,
        i: common_vendor.n(item.from === $data.userId ? "msg-sent" : "msg-received")
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
