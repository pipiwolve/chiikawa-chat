"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const _sfc_main = {
  data() {
    return {
      userId: "",
      password: "",
      nickname: "",
      status: "",
      socketConnected: false
    };
  },
  methods: {
    register() {
      if (!this.userId.trim() || !this.password.trim() || !this.nickname.trim()) {
        this.status = "请输入完整信息";
        return;
      }
      if (!this.socketConnected) {
        utils_socket.connectSocket(this.userId, (msg) => {
          common_vendor.index.__f__("log", "at pages/register/register.vue:40", "[WS] 收到消息:", msg);
          if (msg.cmd === 10 && msg.result === "ok") {
            this.status = "注册成功，跳转登录...";
            common_vendor.index.redirectTo({ url: "/pages/login/login" });
          } else if (msg.cmd === 10 && msg.result === "fail") {
            this.status = "注册失败，用户名可能已存在";
          }
        });
        this.socketConnected = true;
      }
      utils_socket.sendRegister(this.userId, this.password, this.nickname);
      utils_socket.setReadAckHandler((msgIds) => {
        common_vendor.index.__f__("log", "at pages/register/register.vue:58", "[已读回执]", msgIds);
      });
      utils_socket.setGroupHistoryHandler((history) => {
        common_vendor.index.__f__("log", "at pages/register/register.vue:61", "[群历史]", history);
      });
      this.status = "注册请求已发送...";
    },
    goLogin() {
      common_vendor.index.navigateTo({ url: "/pages/login/login" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: $data.userId,
    b: common_vendor.o(($event) => $data.userId = $event.detail.value),
    c: $data.password,
    d: common_vendor.o(($event) => $data.password = $event.detail.value),
    e: $data.nickname,
    f: common_vendor.o(($event) => $data.nickname = $event.detail.value),
    g: common_vendor.o((...args) => $options.register && $options.register(...args)),
    h: common_vendor.o((...args) => $options.goLogin && $options.goLogin(...args)),
    i: common_vendor.t($data.status)
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/register/register.js.map
