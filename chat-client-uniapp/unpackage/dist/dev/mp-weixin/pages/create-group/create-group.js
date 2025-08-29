"use strict";
const utils_socket = require("../../utils/socket.js");
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      groupName: "",
      membersText: "",
      status: ""
    };
  },
  methods: {
    handleCreateGroup() {
      if (!this.groupName) {
        this.status = "请输入群聊名称";
        return;
      }
      const members = this.membersText.split(",").map((m) => m.trim()).filter((m) => m);
      utils_socket.createGroup(this.groupName, members);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.groupName,
    b: common_vendor.o(($event) => $data.groupName = $event.detail.value),
    c: $data.membersText,
    d: common_vendor.o(($event) => $data.membersText = $event.detail.value),
    e: common_vendor.o((...args) => $options.handleCreateGroup && $options.handleCreateGroup(...args)),
    f: $data.status
  }, $data.status ? {
    g: common_vendor.t($data.status)
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-c3f8f667"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/create-group/create-group.js.map
