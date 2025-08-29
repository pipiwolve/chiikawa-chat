"use strict";
const utils_socket = require("../../utils/socket.js");
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      groupId: "",
      role: "",
      status: ""
    };
  },
  methods: {
    handleJoinGroup() {
      if (!this.groupId) {
        this.status = "请输入群ID";
        return;
      }
      utils_socket.joinGroup(this.groupId, this.role);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.groupId,
    b: common_vendor.o(($event) => $data.groupId = $event.detail.value),
    c: $data.role,
    d: common_vendor.o(($event) => $data.role = $event.detail.value),
    e: common_vendor.o((...args) => $options.handleJoinGroup && $options.handleJoinGroup(...args)),
    f: $data.status
  }, $data.status ? {
    g: common_vendor.t($data.status)
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-2920687e"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/join-group/join-group.js.map
