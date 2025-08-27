"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
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
      if (!this.socketConnected) {
        utils_socket.connectSocket(this.userId, (msg) => {
          common_vendor.index.__f__("log", "at pages/login/login.vue:38", "[WS] 收到消息:", msg);
          if (msg.cmd === 11 && msg.result === "ok") {
            this.status = "登录成功，跳转中...";
            common_vendor.index.redirectTo({
              url: "/pages/sessions/sessions?userId=" + this.userId
            });
          } else if (msg.cmd === 11 && msg.result === "fail") {
            this.status = "登录失败，用户名或密码错误";
          }
        });
        this.socketConnected = true;
      }
      utils_socket.sendLogin(this.userId, this.password);
      utils_socket.sendLogin(this.userId, this.password);
      utils_socket.setReadAckHandler((msgIds) => {
        common_vendor.index.__f__("log", "at pages/login/login.vue:63", "[已读回执]", msgIds);
      });
      utils_socket.setGroupHistoryHandler((history) => {
        common_vendor.index.__f__("log", "at pages/login/login.vue:66", "[群历史]", history);
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
    a: $data.userId,
    b: common_vendor.o(($event) => $data.userId = $event.detail.value),
    c: $data.password,
    d: common_vendor.o(($event) => $data.password = $event.detail.value),
    e: common_vendor.o((...args) => $options.login && $options.login(...args)),
    f: common_vendor.o((...args) => $options.goRegister && $options.goRegister(...args)),
    g: common_vendor.t($data.status)
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/login/login.js.map
