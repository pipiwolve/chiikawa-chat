"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      users: [],
      defaultAvatar: "/static/default-avatar/helanzhu.png",
      userId: ""
    };
  },
  onLoad() {
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.loadSessions();
    utils_socket.registerCmdHandler(205, (data) => {
      common_vendor.index.$emit("refreshFriendRequests");
      common_vendor.index.showToast({ title: `${data.fromUser} 申请加你为好友`, icon: "none" });
    });
  },
  methods: {
    // 获取最近会话（cmd=200）
    loadSessions() {
      utils_socket.fetchSessions((resp) => {
        common_vendor.index.__f__("log", "at pages/sessions/sessions.vue:52", "最近会话:", resp.sessions);
        this.users = resp.sessions || [];
      });
    },
    // 点击会话进入聊天
    connect(item) {
      let query = "";
      if (item.userId) {
        query = `?targetId=${item.userId}&type=private`;
      } else if (item.groupId) {
        query = `?targetId=${item.groupId}&type=group`;
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
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($data.users, (item, index, i0) => {
      return common_vendor.e({
        a: item.unread > 0
      }, item.unread > 0 ? {} : {}, {
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
