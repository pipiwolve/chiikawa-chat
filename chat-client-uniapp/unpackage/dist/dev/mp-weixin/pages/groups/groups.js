"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      groups: [],
      defaultGroupAvatar: "/static/default-avatar/hashiqi.png"
    };
  },
  onLoad() {
    this.loadGroups();
    common_vendor.index.$on("refreshGroups", this.loadGroups);
    utils_socket.registerCmdHandler(203, (data) => {
      common_vendor.index.showToast({ title: `群聊 ${data.groupName} 创建成功`, icon: "success" });
      common_vendor.index.$emit("refreshGroups");
    });
    utils_socket.registerCmdHandler(204, (data) => {
      common_vendor.index.showToast({ title: `你已加入群聊 ${data.groupName}`, icon: "success" });
      common_vendor.index.$emit("refreshGroups");
    });
    utils_socket.setJoinGroupHandler((msg) => {
      if (msg.cmd === 214) {
        common_vendor.index.showToast({ title: `收到新加入群申请`, icon: "none" });
      } else if (msg.cmd === 210) {
        common_vendor.index.showToast({ title: `群聊列表已更新`, icon: "success" });
        common_vendor.index.$emit("refreshGroups");
      }
    });
  },
  onUnload() {
    common_vendor.index.$off("refreshGroups", this.loadGroups);
    utils_socket.unregisterCmdHandler(212);
    utils_socket.unregisterCmdHandler(203);
    utils_socket.unregisterCmdHandler(204);
    utils_socket.unregisterCmdHandler(214);
    utils_socket.unregisterCmdHandler(210);
  },
  methods: {
    loadGroups() {
      utils_socket.fetchGroups((res) => {
        common_vendor.index.__f__("log", "at pages/groups/groups.vue:93", "[Groups] 收到群聊列表:", res);
        if (res.groups) {
          this.groups = res.groups;
        }
      });
    },
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
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_assets._imports_0$2,
    b: common_vendor.o((...args) => $options.gotoCreateGroup && $options.gotoCreateGroup(...args)),
    c: common_assets._imports_1$1,
    d: common_vendor.o((...args) => $options.gotoJoinGroup && $options.gotoJoinGroup(...args)),
    e: common_assets._imports_1$1,
    f: common_vendor.o((...args) => $options.gotoGroupRequest && $options.gotoGroupRequest(...args)),
    g: $data.groups.length === 0
  }, $data.groups.length === 0 ? {} : {}, {
    h: common_vendor.f($data.groups, (item, idx, i0) => {
      return {
        a: item.avatar || $data.defaultGroupAvatar,
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
