"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      groupId: "",
      status: "",
      userId: ""
    };
  },
  onLoad() {
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
  },
  methods: {
    handleJoinGroup() {
      if (!this.groupId) {
        this.status = "请输入群ID";
        return;
      }
      utils_socket.sendJoinGroupRequest(this.groupId, this.userId).then((res) => {
        if (res.result === "pending") {
          this.status = "申请已发送，请等待群主处理";
          common_vendor.index.showToast({ title: "申请已发送", icon: "success" });
          setTimeout(() => common_vendor.index.navigateBack(), 800);
        } else {
          this.status = "发送失败: " + (res.reason || "未知错误");
        }
      }).catch((err) => {
        common_vendor.index.__f__("error", "at pages/join-group/join-group.vue:51", "[join-group] 发送申请失败:", err);
        this.status = "发送失败，请重试";
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.groupId,
    b: common_vendor.o(($event) => $data.groupId = $event.detail.value),
    c: common_vendor.o((...args) => $options.handleJoinGroup && $options.handleJoinGroup(...args)),
    d: $data.status
  }, $data.status ? {
    e: common_vendor.t($data.status)
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/join-group/join-group.js.map
