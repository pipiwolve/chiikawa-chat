"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      userId: ""
      // ✅ 1. 当前用户 ID
    };
  },
  computed: {
    ...common_vendor.mapState("friendRequests", ["list"]),
    defaultAvatar: () => "/static/default-avatar/yang.png"
  },
  methods: {
    ...common_vendor.mapActions("friendRequests", ["loadList", "agree"]),
    /* 兜底拉取：把 userId 传给 Vuex，后端需要 */
    loadRequests() {
      this.loadList({ userId: this.userId });
    },
    // 点击同意
    respond(fromUser) {
      this.agree({ fromUser, userId: this.userId });
    },
    gotoAddFriend() {
      common_vendor.index.navigateTo({ url: "/pages/add-friend/add-friend" });
    }
  },
  onLoad() {
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.loadRequests();
  },
  onShow() {
    this.loadRequests();
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_assets._imports_0$4,
    b: common_vendor.o((...args) => $options.gotoAddFriend && $options.gotoAddFriend(...args)),
    c: common_vendor.f(_ctx.list, (req, index, i0) => {
      return {
        a: req.avatar || $options.defaultAvatar,
        b: common_vendor.t(req.username || req.fromUser),
        c: common_vendor.t(req.message || "请求加你为好友"),
        d: common_vendor.o(($event) => $options.respond(req.fromUser, "accept"), index),
        e: index
      };
    }),
    d: _ctx.list.length === 0
  }, _ctx.list.length === 0 ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-7c72e8e3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/friends-request/friends-request.js.map
