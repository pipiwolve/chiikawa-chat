"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      userId: ""
      // ✅ 1. 补上 userId
    };
  },
  computed: {
    ...common_vendor.mapState("groupRequests", ["list"]),
    defaultAvatar: () => "/static/default-avatar/helanzhu.png"
  },
  methods: {
    ...common_vendor.mapActions("groupRequests", ["loadList"]),
    /* 兜底拉取：把当前用户ID传进去 */
    loadRequests() {
      this.loadList({ userId: this.userId });
    },
    agreeRequest(req) {
      utils_socket.sendCmdMessage(210, {
        fromUser: this.userId,
        // ✅ 用本页 data 里的 userId
        applicant: req.fromUser,
        groupId: req.groupId
      });
      common_vendor.index.showToast({ title: "已同意申请", icon: "success" });
      this.$store.commit("groupRequests/REMOVE_ONE", req.fromUser);
    },
    shortId(id) {
      return id ? id.slice(0, 8) + "…" : "";
    },
    copyId(id) {
      common_vendor.index.setClipboardData({ data: id });
    },
    gotoGroups() {
      common_vendor.index.navigateTo({ url: "/pages/groups/groups" });
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
    a: common_assets._imports_0$5,
    b: common_vendor.o((...args) => $options.gotoGroups && $options.gotoGroups(...args)),
    c: common_vendor.f(_ctx.list, (req, index, i0) => {
      return {
        a: req.avatar || $options.defaultAvatar,
        b: common_vendor.t(req.username || req.fromUser),
        c: common_vendor.t($options.shortId(req.groupId)),
        d: common_vendor.o(($event) => $options.copyId(req.groupId), index),
        e: common_vendor.o(($event) => $options.agreeRequest(req), index),
        f: index
      };
    }),
    d: _ctx.list.length === 0
  }, _ctx.list.length === 0 ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-7b319bbd"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/group-requests/group-requests.js.map
