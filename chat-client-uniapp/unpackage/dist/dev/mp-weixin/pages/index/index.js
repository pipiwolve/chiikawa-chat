"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  methods: {
    goChat(userId) {
      common_vendor.index.navigateTo({
        url: `/pages/chat/chat?userId=${userId}`
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o(($event) => $options.goChat("user1")),
    b: common_vendor.o(($event) => $options.goChat("user2")),
    c: common_vendor.o(($event) => $options.goChat("user3"))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
