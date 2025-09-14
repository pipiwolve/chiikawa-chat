"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      userId: "",
      password: "",
      status: "",
      socketConnected: false
    };
  },
  methods: {
    login() {
      if (!this.userId.trim() || !this.password.trim()) {
        this.status = "请输入用户名和密码";
        return;
      }
      common_vendor.index.request({
        url: "http://localhost:8080/api/auth/login",
        method: "POST",
        data: {
          userId: this.userId,
          password: this.password
        },
        success: (res) => {
          if (res.data.result === "ok") {
            const token = res.data.token;
            const username = res.data.username;
            const avatar = res.data.avatar;
            common_vendor.index.setStorageSync("token", token);
            common_vendor.index.setStorageSync("currentUserId", this.userId);
            common_vendor.index.setStorageSync("currentUserName", username || "");
            common_vendor.index.setStorageSync("currentUserAvatar", avatar || "/static/default-avatar/wusaqi.png");
            utils_socket.connectSocket(this.userId, token, (msg) => {
              if (msg.result === "ok") {
                this.status = "登录成功，跳转中...";
                common_vendor.index.switchTab({ url: "/pages/sessions/sessions" });
              } else if (msg.result === "fail") {
                this.status = "登录失败，用户名或密码错误";
              }
            });
          } else {
            this.status = res.data.message || "登录失败";
          }
        }
      });
      utils_socket.setReadAckHandler((msgIds) => {
        common_vendor.index.__f__("log", "at pages/login/login.vue:75", "[已读回执]", msgIds);
      });
      utils_socket.setGroupHistoryHandler((history) => {
        common_vendor.index.__f__("log", "at pages/login/login.vue:78", "[群历史]", history);
      });
      this.status = "登录请求已发送...";
    },
    goRegister() {
      common_vendor.index.navigateTo({ url: "/pages/register/register" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_assets._imports_0$2,
    b: $data.userId,
    c: common_vendor.o(($event) => $data.userId = $event.detail.value),
    d: $data.password,
    e: common_vendor.o(($event) => $data.password = $event.detail.value),
    f: common_vendor.o((...args) => $options.login && $options.login(...args)),
    g: common_vendor.o((...args) => $options.goRegister && $options.goRegister(...args)),
    h: common_vendor.t($data.status)
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/login/login.js.map
