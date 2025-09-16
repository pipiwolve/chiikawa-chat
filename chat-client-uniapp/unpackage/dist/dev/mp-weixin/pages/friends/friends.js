"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  computed: {
    ...common_vendor.mapState("friends", ["list"]),
    // 全局 list
    // 本地常量
    defaultAvatar() {
      return "/static/default-avatar/xianluomao.png";
    }
  },
  onload() {
    this.userId = common_vendor.index.getStorageSync("currentUserId") || "";
  },
  onShow() {
    this.loadFriends({ userId: this.userId });
  },
  methods: {
    ...common_vendor.mapActions("friends", ["loadFriends"]),
    // 打开 + 菜单
    openMenu() {
      common_vendor.index.showActionSheet({
        itemList: ["添加好友", "加入群聊", "创建群聊"],
        success: (res) => {
          if (res.tapIndex === 0) {
            common_vendor.index.navigateTo({ url: `/pages/add-friend/add-friend?userId=${this.userId}` });
          } else if (res.tapIndex === 1) {
            common_vendor.index.navigateTo({ url: `/pages/join-group/join-group?userId=${this.userId}` });
          } else if (res.tapIndex === 2) {
            common_vendor.index.navigateTo({ url: `/pages/create-group/create-group?userId=${this.userId}` });
          }
        }
      });
    },
    // 点击会话进入聊天
    connect(item) {
      let query = "";
      if (item.userId) {
        query = `?targetId=${item.userId}&type=private`;
        common_vendor.index.navigateTo({
          url: "/pages/chat/chat" + query
        });
      }
    },
    gotoFriendRequests() {
      common_vendor.index.navigateTo({ url: "/pages/friends-request/friends-request" });
    },
    gotoGroups() {
      common_vendor.index.navigateTo({ url: "/pages/groups/groups" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_assets._imports_0$3,
    b: common_assets._imports_1$1,
    c: common_vendor.o((...args) => $options.gotoFriendRequests && $options.gotoFriendRequests(...args)),
    d: common_assets._imports_2$1,
    e: common_vendor.o((...args) => $options.gotoGroups && $options.gotoGroups(...args)),
    f: common_assets._imports_3,
    g: common_vendor.o((...args) => $options.openMenu && $options.openMenu(...args)),
    h: common_vendor.f(_ctx.list, (item, index, i0) => {
      return {
        a: item.avatar || $options.defaultAvatar,
        b: common_vendor.t(item.username),
        c: index,
        d: common_vendor.o(($event) => $options.connect(item), index)
      };
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-db42cae2"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/friends/friends.js.map
