"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  computed: {
    ...common_vendor.mapState("groups", ["list"]),
    // 直接读全局 list
    defaultGroupAvatar() {
      return "/static/default-avatar/xianluomao.png";
    }
  },
  methods: {
    ...common_vendor.mapActions("groups", ["loadGroups"]),
    gotoCreateGroup() {
      common_vendor.index.navigateTo({ url: "/pages/create-group/create-group" });
    },
    gotoJoinGroup() {
      common_vendor.index.navigateTo({ url: "/pages/join-group/join-group" });
    },
    gotoGroupRequest() {
      common_vendor.index.navigateTo({ url: "/pages/group-requests/group-requests" });
    },
    // 点击会话进入聊天
    connect(item) {
      let query = "";
      if (item.groupId) {
        query = `?targetId=${item.groupId}&type=group`;
        common_vendor.index.navigateTo({
          url: "/pages/chat/chat" + query
        });
      }
    }
  },
  onShow() {
    this.loadGroups();
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_assets._imports_0$3,
    b: common_assets._imports_1$2,
    c: common_vendor.o((...args) => $options.gotoCreateGroup && $options.gotoCreateGroup(...args)),
    d: common_assets._imports_2$2,
    e: common_vendor.o((...args) => $options.gotoJoinGroup && $options.gotoJoinGroup(...args)),
    f: common_assets._imports_3$1,
    g: common_vendor.o((...args) => $options.gotoGroupRequest && $options.gotoGroupRequest(...args)),
    h: _ctx.list.length === 0
  }, _ctx.list.length === 0 ? {} : {}, {
    i: common_vendor.f(_ctx.list, (item, idx, i0) => {
      return {
        a: item.avatar || $options.defaultGroupAvatar,
        b: common_vendor.t(item.groupName),
        c: idx,
        d: common_vendor.o(($event) => $options.connect(item), idx)
      };
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-5f8c2705"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/groups/groups.js.map
