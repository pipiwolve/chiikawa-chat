"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  methods: {
    toLogin() {
      common_vendor.index.navigateTo({ url: "/pages/login/login" });
    },
    toRegister() {
      common_vendor.index.navigateTo({ url: "/pages/register/register" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o((...args) => $options.toLogin && $options.toLogin(...args)),
    b: common_vendor.o((...args) => $options.toRegister && $options.toRegister(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
