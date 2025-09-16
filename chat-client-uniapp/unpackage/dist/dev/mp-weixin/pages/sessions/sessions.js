"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  computed: {
    ...common_vendor.mapState("sessions", ["list"]),
    // 全局 list
    defaultAvatar: () => "/static/default-avatar/xiaoqi.png"
  },
  onShow() {
    this.loadList();
  },
  methods: {
    ...common_vendor.mapActions("sessions", ["loadList"]),
    // 点击会话进入聊天
    connect(item) {
      let query = `?targetId=${item.sessionId}&type=${item.type}&name=${item.nickname}`;
      common_vendor.index.navigateTo({
        url: "/pages/chat/chat" + query
      });
    },
    formatLastMsg(item) {
      if (!item)
        return "暂无消息";
      if (item.messageType === "image") {
        return "[图片]";
      } else if (item.messageType === "voice") {
        return "[语音]";
      } else {
        return item.lastMsg || "暂无消息";
      }
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
    a: common_assets._imports_0$3,
    b: common_vendor.f(_ctx.list, (item, index, i0) => {
      return common_vendor.e({
        a: item.hasUnread > 0
      }, item.hasUnread > 0 ? {} : {}, {
        b: item.avatar || $options.defaultAvatar,
        c: common_vendor.t(item.nickname || item.name),
        d: common_vendor.t($options.formatTime(item.lastTime)),
        e: common_vendor.t($options.formatLastMsg(item) || "暂无消息"),
        f: index,
        g: common_vendor.o(($event) => $options.connect(item), index)
      });
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-9437a25b"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/sessions/sessions.js.map
