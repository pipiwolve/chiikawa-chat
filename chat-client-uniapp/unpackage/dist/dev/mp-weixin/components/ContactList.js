"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  props: {
    users: {
      type: Array,
      required: true
    },
    selectedUserId: {
      type: String,
      default: ""
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($props.users, (user, k0, i0) => {
      return {
        a: common_vendor.t(user.name),
        b: user.id,
        c: common_vendor.n(user.id === $props.selectedUserId ? "active" : ""),
        d: common_vendor.o(($event) => _ctx.$emit("select", user.id), user.id)
      };
    })
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/ContactList.js.map
