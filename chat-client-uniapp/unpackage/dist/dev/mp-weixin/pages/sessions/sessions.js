"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      users: [],
      defaultAvatar: "/static/default-avatar/xiaoqi.png",
      userId: ""
    };
  },
  onLoad() {
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    common_vendor.index.__f__("log", "at pages/sessions/sessions.vue:38", "消息中心取到用户ID", this.userId);
    this.loadSessions();
    utils_socket.registerCmdHandler(205, (data) => {
      common_vendor.index.$emit("refreshFriendRequests");
      common_vendor.index.showToast({ title: `${data.fromUser} 申请加你为好友`, icon: "none" });
    });
    utils_socket.registerCmdHandler(207, (data) => {
      common_vendor.index.showToast({ title: `你和 ${data.friendId} 已成为好友`, icon: "success" });
      common_vendor.index.$emit("refreshFriends");
      this.loadSessions();
    });
    utils_socket.registerCmdHandler(101, (data) => {
      this.loadSessions();
    });
    utils_socket.registerCmdHandler(201, () => this.loadSessions());
    utils_socket.registerCmdHandler(203, () => this.loadSessions());
    utils_socket.registerCmdHandler(204, () => this.loadSessions());
    common_vendor.index.$on("sessionsUpdated", (resp) => {
      common_vendor.index.__f__("log", "at pages/sessions/sessions.vue:68", "[sessions.vue] 收到 sessionsUpdated:", resp);
      this.users = (resp.sessions || []).map((s) => ({
        ...s,
        hasUnread: (s.unread || 0) > 0 || (s.pendingFriendRequest || false)
      }));
    });
    common_vendor.index.$on("clearUnread", this.loadSessions);
    common_vendor.index.$on("refreshSessions", this.loadSessions);
    common_vendor.index.$on("refreshFriends", this.loadSessions);
    common_vendor.index.$on("refreshGroups", this.loadSessions);
  },
  onUnload() {
    common_vendor.index.$off("refreshFriends", this.loadSessions);
    common_vendor.index.$off("refreshGroups", this.loadSessions);
    common_vendor.index.$off("refreshSessions", this.loadSessions);
    common_vendor.index.$off("clearUnread", this.loadSessions);
    common_vendor.index.$off("sessionsUpdated");
    utils_socket.unregisterCmdHandler(205);
    utils_socket.unregisterCmdHandler(207);
    utils_socket.unregisterCmdHandler(201);
    utils_socket.unregisterCmdHandler(203);
    utils_socket.unregisterCmdHandler(204);
    utils_socket.unregisterCmdHandler(101);
  },
  methods: {
    // 获取最近会话（cmd=200）
    loadSessions() {
      utils_socket.fetchSessions((resp) => {
        common_vendor.index.__f__("log", "at pages/sessions/sessions.vue:106", "[Sessions] 最近会话:", resp.sessions);
        this.users = (resp.sessions || []).map((s) => ({
          ...s,
          // 标记未读：未读消息或存在待处理好友请求
          hasUnread: (s.unread || 0) > 0 || (s.pendingFriendRequest || false)
        }));
      });
    },
    // 点击会话进入聊天
    connect(item) {
      let query = `?targetId=${item.sessionId}&type=${item.type}`;
      common_vendor.index.navigateTo({
        url: "/pages/chat/chat" + query
      });
    },
    // 格式化时间
    formatTime(ts) {
      if (!ts)
        return "";
      let dateObj;
      if (typeof ts === "string") {
        const normalized = ts.replace(/-/g, "/").replace(" ", "T");
        dateObj = new Date(normalized);
      } else {
        dateObj = new Date(ts);
      }
      if (isNaN(dateObj.getTime()))
        return "";
      const hours = dateObj.getHours().toString().padStart(2, "0");
      const minutes = dateObj.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($data.users, (item, index, i0) => {
      return common_vendor.e({
        a: item.hasUnread > 0
      }, item.hasUnread > 0 ? {} : {}, {
        b: item.avatar || $data.defaultAvatar,
        c: common_vendor.t(item.nickname || item.name),
        d: common_vendor.t($options.formatTime(item.lastTime)),
        e: common_vendor.t(item.lastMsg || "暂无消息"),
        f: index,
        g: common_vendor.o(($event) => $options.connect(item), index)
      });
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-9437a25b"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/sessions/sessions.js.map
