"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const utils_socket = require("./utils/socket.js");
const store_index = require("./store/index.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/chat/chat.js";
  "./pages/login/login.js";
  "./pages/register/register.js";
  "./pages/sessions/sessions.js";
  "./pages/friends/friends.js";
  "./pages/add-friend/add-friend.js";
  "./pages/join-group/join-group.js";
  "./pages/create-group/create-group.js";
  "./pages/friends-request/friends-request.js";
  "./pages/groups/groups.js";
  "./pages/group-requests/group-requests.js";
  "./pages/myself/myself.js";
}
const _sfc_main = {
  onLaunch: function() {
    common_vendor.index.__f__("warn", "at App.vue:6", "当前组件仅支持 uni_modules 目录结构 ，请升级 HBuilderX 到 3.1.0 版本以上！");
    common_vendor.index.__f__("log", "at App.vue:7", "App Launch");
    utils_socket.registerCmdHandler(205, (data) => {
      common_vendor.index.showToast({ title: `收到${data.fromUser}的好友申请`, icon: "none" });
      store_index.store.dispatch("friendRequests/addRequest", {
        fromUser: data.fromUser,
        username: data.username || data.fromUser,
        avatar: data.avatar || "",
        message: data.message || `${data.fromUser} 想加你为好友`
      });
    });
    utils_socket.registerCmdHandler(206, () => {
      common_vendor.index.showToast({ title: "你已同意好友申请", icon: "none" });
      store_index.store.dispatch("friends/loadFriends", true);
      store_index.store.dispatch("sessions/loadList", true);
    });
    utils_socket.registerCmdHandler(207, (data) => {
      store_index.store.dispatch("friends/loadFriends", true);
      if (data.friendId !== common_vendor.index.getStorageSync("currentUserId")) {
        common_vendor.index.showToast({ title: `你和 ${data.userId} 已成为好友`, icon: "none" });
      }
    });
    utils_socket.registerCmdHandler(210, (data) => {
      common_vendor.index.showToast({ title: "群聊列表已更新", icon: "none" });
      store_index.store.dispatch("groups/loadGroups", true);
    });
    utils_socket.registerCmdHandler(204, (data) => {
      common_vendor.index.showToast({ title: `你已加入群聊 ${data.groupName}`, icon: `none` });
      store_index.store.dispatch("groups/loadGroups", true);
      store_index.store.dispatch("sessions/loadList", true);
    });
    utils_socket.registerCmdHandler(218, (msg) => {
      common_vendor.index.showToast({ title: `收到${msg.fromUser}群聊申请`, icon: "none" });
      store_index.store.dispatch("groupRequests/addRequest", msg);
      store_index.store.dispatch("groupRequests/loadList", true);
    });
  },
  onShow: function() {
    common_vendor.index.__f__("log", "at App.vue:64", "App Show");
  },
  onHide: function() {
    common_vendor.index.__f__("log", "at App.vue:67", "App Hide");
  }
};
function createApp() {
  const app = common_vendor.createSSRApp(_sfc_main);
  app.use(store_index.store);
  return {
    app
  };
}
createApp().app.mount("#app");
exports.createApp = createApp;
//# sourceMappingURL=../.sourcemap/mp-weixin/app.js.map
