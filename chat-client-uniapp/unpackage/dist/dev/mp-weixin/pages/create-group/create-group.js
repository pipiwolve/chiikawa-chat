"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  __name: "create-group",
  setup(__props) {
    const store = common_vendor.useStore();
    const groupName = common_vendor.ref("");
    const membersText = common_vendor.ref("");
    const status = common_vendor.ref("");
    function handleCreateGroup() {
      if (!groupName.value.trim()) {
        status.value = "请输入群聊名称";
        return;
      }
      const members = membersText.value.split(",").map((m) => m.trim()).filter((m) => m);
      status.value = "正在创建...";
      utils_socket.createGroup(groupName.value, members);
    }
    common_vendor.onShow(() => {
      store.dispatch("groups/loadGroups");
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: groupName.value,
        b: common_vendor.o(($event) => groupName.value = $event.detail.value),
        c: membersText.value,
        d: common_vendor.o(($event) => membersText.value = $event.detail.value),
        e: common_vendor.o(handleCreateGroup),
        f: status.value
      }, status.value ? {
        g: common_vendor.t(status.value)
      } : {});
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-c3f8f667"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/create-group/create-group.js.map
