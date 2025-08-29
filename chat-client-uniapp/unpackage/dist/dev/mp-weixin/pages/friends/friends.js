"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      friends: [],
      defaultAvatar: "/static/default-avatar/xianluomao.png"
    };
  },
  onLoad() {
    this.loadFriends();
    common_vendor.index.$on("refreshFriends", this.loadFriends);
    utils_socket.registerCmdHandler(207, (data) => {
      common_vendor.index.showToast({ title: `你和 ${data.friendId} 已成为好友`, icon: "success" });
      common_vendor.index.$emit("refreshFriends");
    });
  },
  onUnload() {
    common_vendor.index.$off("refreshFriends", this.loadFriends);
    utils_socket.unregisterCmdHandler(200);
    utils_socket.unregisterCmdHandler(207);
  },
  methods: {
    loadFriends() {
      utils_socket.fetchFriends((res) => {
        common_vendor.index.__f__("log", "at pages/friends/friends.vue:66", "[Friends] 收到好友列表:", res);
        if (res.friends) {
          this.friends = res.friends;
        }
      });
    },
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
    a: common_assets._imports_0,
    b: common_vendor.o((...args) => $options.gotoFriendRequests && $options.gotoFriendRequests(...args)),
    c: common_assets._imports_1,
    d: common_vendor.o((...args) => $options.gotoGroups && $options.gotoGroups(...args)),
    e: common_assets._imports_2,
    f: common_vendor.o((...args) => $options.openMenu && $options.openMenu(...args)),
    g: common_vendor.f($data.friends, (item, index, i0) => {
      return {
        a: item.avatar || $data.defaultAvatar,
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
