"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      requests: [],
      defaultAvatar: "/static/default-avatar/yang.png"
    };
  },
  onLoad() {
    utils_socket.registerCmdHandler(205, (data) => {
      this.requests.unshift({
        fromUser: data.fromUser,
        username: data.username || data.fromUser,
        avatar: data.avatar || "",
        message: data.message || `${data.fromUser} 想加你为好友`
      });
    });
    utils_socket.fetchFriendRequests((data) => {
      common_vendor.index.__f__("log", "at pages/friends-request/friends-request.vue:51", "[Friends-Requests] 收到好友申请列表:", data);
      if (data.requests) {
        this.requests = data.requests.map((r) => ({
          fromUser: r.fromUser,
          username: r.username || r.fromUser,
          avatar: r.avatar || "",
          message: r.message || `${r.fromUser} 想加你为好友`
        }));
      }
    });
  },
  onUnload() {
    utils_socket.registerCmdHandler(205, null);
    utils_socket.registerCmdHandler(209, null);
  },
  methods: {
    respond(fromUser, action) {
      const currentUser = common_vendor.index.getStorageSync("currentUserId");
      utils_socket.respondFriendRequest(fromUser, currentUser, action);
      this.requests = this.requests.filter((r) => r.fromUser !== fromUser);
    },
    gotoAddFriend() {
      common_vendor.index.navigateTo({ url: "/pages/add-friend/add-friend" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_assets._imports_0$4,
    b: common_vendor.o((...args) => $options.gotoAddFriend && $options.gotoAddFriend(...args)),
    c: common_vendor.f($data.requests, (req, index, i0) => {
      return {
        a: req.avatar || $data.defaultAvatar,
        b: common_vendor.t(req.username || req.fromUser),
        c: common_vendor.t(req.message || "请求加你为好友"),
        d: common_vendor.o(($event) => $options.respond(req.fromUser, "accept"), index),
        e: index
      };
    }),
    d: $data.requests.length === 0
  }, $data.requests.length === 0 ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-7c72e8e3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/friends-request/friends-request.js.map
