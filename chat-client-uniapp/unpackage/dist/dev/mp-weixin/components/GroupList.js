"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  name: "GroupList",
  props: {
    groups: {
      type: Array,
      required: true
    },
    selectedGroupId: {
      type: String,
      default: ""
    }
  },
  methods: {
    selectGroup(groupId) {
      this.$emit("select", groupId);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($props.groups, (group, k0, i0) => {
      return {
        a: common_vendor.t(group.name),
        b: group.id,
        c: common_vendor.n(group.id === $props.selectedGroupId ? "selected" : ""),
        d: common_vendor.o(($event) => $options.selectGroup(group.id), group.id)
      };
    })
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-804895da"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/GroupList.js.map
