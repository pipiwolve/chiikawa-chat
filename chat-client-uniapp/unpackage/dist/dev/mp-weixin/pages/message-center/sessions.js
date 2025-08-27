"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      userId: "",
      users: [],
      // 最近会话列表
      defaultAvatar: "/static/default-avatar.png",
      socketConnected: false,
      socketTask: null
    };
  },
  onLoad(options) {
    this.userId = options.userId || "";
    if (!this.userId)
      return;
    this.socketTask = utils_socket.connectSocket(this.userId, this.handleWSMessage);
  },
  methods: {
    // WebSocket 消息回调
    handleWSMessage(msg) {
      common_vendor.index.__f__("log", "at pages/message-center/sessions.vue:47", "[WS] 收到消息:", msg);
      if (Array.isArray(msg) && msg.length && msg[0].sessionId) {
        this.users = msg;
      }
    },
    // 发送 cmd=200 请求最近会话
    fetchSessions() {
      const data = { cmd: 200, fromUser: this.userId };
      if (this.socketTask && this.socketConnected) {
        try {
          this.socketTask.send({
            data: JSON.stringify(data),
            success: () => common_vendor.index.__f__("log", "at pages/message-center/sessions.vue:61", "[WS] 请求最近会话成功"),
            fail: (err) => common_vendor.index.__f__("error", "at pages/message-center/sessions.vue:62", "[WS] 请求失败", err)
          });
        } catch (e) {
          common_vendor.index.__f__("error", "at pages/message-center/sessions.vue:65", "[WS] 发送异常", e);
        }
      }
    },
    // 点击跳转到聊天页面
    connect(item) {
      let query = "";
      if (item.type === "private") {
        query = `?targetId=${item.sessionId}&type=private`;
      } else if (item.type === "group") {
        query = `?targetId=${item.sessionId}&type=group`;
      }
      common_vendor.index.navigateTo({
        url: "/pages/chat/chat" + query
      });
    },
    // 格式化时间
    formatTime(ts) {
      if (!ts)
        return "";
      const d = new Date(ts);
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
  },
  onShow() {
    this.fetchSessions();
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($data.users, (item, index, i0) => {
      return common_vendor.e({
        a: item.unread > 0
      }, item.unread > 0 ? {
        b: common_vendor.t(item.unread)
      } : {}, {
        c: item.avatar || $data.defaultAvatar,
        d: common_vendor.t(item.nickname || item.name),
        e: common_vendor.t($options.formatTime(item.lastTime)),
        f: common_vendor.t(item.lastMsg || "暂无消息"),
        g: index,
        h: common_vendor.o(($event) => $options.connect(item), index)
      });
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8dcd14f4"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/message-center/sessions.js.map
