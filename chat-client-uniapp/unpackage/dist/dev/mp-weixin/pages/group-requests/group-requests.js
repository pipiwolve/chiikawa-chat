"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      requests: [],
      userId: "",
      defaultAvatar: "/static/default-avatar/helanzhu.png"
    };
  },
  onLoad() {
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
    this.loadRequests();
    utils_socket.registerCmdHandler(215, (msg) => {
      common_vendor.index.__f__("log", "at pages/group-requests/group-requests.vue:49", "[215] 群聊申请:", msg);
      this.requests = msg.requests || [];
    });
    utils_socket.registerCmdHandler(214, (msg) => {
      common_vendor.index.__f__("log", "at pages/group-requests/group-requests.vue:55", "[214] 收到新的群聊申请:", msg);
      this.loadRequests();
    });
  },
  onUnload() {
    utils_socket.unregisterCmdHandler(214);
    utils_socket.unregisterCmdHandler(215);
  },
  methods: {
    /** 加载群聊申请 */
    loadRequests() {
      utils_socket.fetchGroupRequests();
    },
    refreshRequests() {
      this.loadRequests();
    },
    agreeRequest(req) {
      utils_socket.sendCmdMessage(210, {
        fromUser: this.userId,
        applicant: req.fromUser,
        // ✅ 只传字符串
        groupId: req.groupId
      });
      common_vendor.index.showToast({ title: "已同意申请", icon: "success" });
      this.requests = this.requests.filter((r) => !(r.fromUser === req.fromUser && r.groupId === req.groupId));
      common_vendor.index.$emit("refreshGroups");
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
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_assets._imports_0$5,
    b: common_vendor.o((...args) => $options.gotoGroups && $options.gotoGroups(...args)),
    c: common_vendor.f($data.requests, (req, index, i0) => {
      return {
        a: req.avatar || $data.defaultAvatar,
        b: common_vendor.t(req.username || req.fromUser),
        c: common_vendor.t($options.shortId(req.groupId)),
        d: common_vendor.o(($event) => $options.copyId(req.groupId), index),
        e: common_vendor.o(($event) => $options.agreeRequest(req), index),
        f: index
      };
    }),
    d: $data.requests.length === 0
  }, $data.requests.length === 0 ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-7b319bbd"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/group-requests/group-requests.js.map
