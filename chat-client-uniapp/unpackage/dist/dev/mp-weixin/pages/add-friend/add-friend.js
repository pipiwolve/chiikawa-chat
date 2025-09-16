"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      toUserId: ""
    };
  },
  onLoad() {
    utils_socket.registerCmdHandler(202, (data) => {
      if (data.result === "pending") {
        common_vendor.index.showToast({ title: `好友申请已发送`, icon: `none` });
      } else if (data.result === "fail") {
        common_vendor.index.showToast({ title: `好友申请失败`, icon: `none` });
      }
    });
  },
  methods: {
    sendFriendRequest() {
      if (!this.toUserId.trim()) {
        common_vendor.index.showToast({ title: "请输入好友用户名", icon: "none" });
        return;
      }
      utils_socket.sendFriendRequest(this.toUserId);
    }
  },
  onUnload() {
    utils_socket.registerCmdHandler(202, null);
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.toUserId,
    b: common_vendor.o(($event) => $data.toUserId = $event.detail.value),
    c: common_vendor.o((...args) => $options.sendFriendRequest && $options.sendFriendRequest(...args)),
    d: _ctx.status
  }, _ctx.status ? {
    e: common_vendor.t(_ctx.status)
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-9e12f509"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/add-friend/add-friend.js.map
