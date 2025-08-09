"use strict";
const utils_socket = require("../../utils/socket.js");
const common_vendor = require("../../common/vendor.js");
const ContactList = () => "../../components/ContactList.js";
const _sfc_main = {
  components: { ContactList },
  data() {
    return {
      messages: [],
      inputMsg: "",
      userId: "",
      targetId: "",
      contacts: [
        { id: "user1", name: "用户一" },
        { id: "user2", name: "用户二" },
        { id: "user3", name: "用户三" }
      ]
    };
  },
  onLoad(options) {
    var _a;
    this.userId = options.userId || "user1";
    this.targetId = ((_a = this.contacts.find((c) => c.id !== this.userId)) == null ? void 0 : _a.id) || "";
    utils_socket.connectSocket(this.userId, (msg) => {
      this.messages.push(msg);
    });
  },
  methods: {
    sendMsg() {
      if (!this.inputMsg)
        return;
      utils_socket.sendMsg(this.targetId, this.inputMsg, this.userId);
      this.messages.push({ from: this.userId, text: this.inputMsg });
      this.inputMsg = "";
    },
    handleSelectUser(userId) {
      this.targetId = userId;
    }
  }
};
if (!Array) {
  const _component_ContactList = common_vendor.resolveComponent("ContactList");
  _component_ContactList();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o($options.handleSelectUser),
    b: common_vendor.p({
      users: $data.contacts,
      selectedUserId: $data.targetId
    }),
    c: common_vendor.f($data.messages, (item, index, i0) => {
      return {
        a: common_vendor.t(item.from),
        b: common_vendor.t(item.text),
        c: index
      };
    }),
    d: $data.inputMsg,
    e: common_vendor.o(($event) => $data.inputMsg = $event.detail.value),
    f: common_vendor.o((...args) => $options.sendMsg && $options.sendMsg(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/chat.js.map
