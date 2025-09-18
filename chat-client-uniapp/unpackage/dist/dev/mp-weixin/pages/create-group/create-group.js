"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_socket = require("../../utils/socket.js");
const defaultAvatar = "/static/default-avatar/xiaoqi.png";
const UPLOAD_URL = "http://localhost:8080/api/upload";
const _sfc_main = {
  __name: "create-group",
  setup(__props) {
    const store = common_vendor.useStore();
    const groupName = common_vendor.ref("");
    const membersText = common_vendor.ref("");
    const status = common_vendor.ref("");
    const avatar = common_vendor.ref("");
    const avatarUploadPath = common_vendor.ref("");
    function chooseAvatar() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: (res) => {
          const localPath = res.tempFilePaths[0];
          avatar.value = localPath;
          avatarUploadPath.value = localPath;
          common_vendor.index.__f__("log", "at pages/create-group/create-group.vue:53", "[chooseAvatar] avatar.value=", localPath);
        },
        fail: (err) => common_vendor.index.__f__("error", "at pages/create-group/create-group.vue:55", "[chooseAvatar] fail", err)
      });
    }
    function handleCreateGroup() {
      if (!groupName.value.trim()) {
        status.value = "请输入群聊名称";
        return;
      }
      const members = membersText.value.split(",").map((m) => m.trim()).filter((m) => m);
      status.value = "正在创建...";
      common_vendor.index.__f__("log", "at pages/create-group/create-group.vue:70", "[handleCreateGroup] start", groupName.value, members);
      utils_socket.createGroup(
        groupName.value,
        members,
        utils_socket.registerCmdHandler(203, (data) => {
          common_vendor.index.__f__("log", "at pages/create-group/create-group.vue:73", "[createGroup callback] resp=", data);
          if (data.result === "ok") {
            common_vendor.index.__f__("log", "at pages/create-group/create-group.vue:75", "[createGroup] ok groupId=", data.groupId);
            common_vendor.index.__f__("log", "at pages/create-group/create-group.vue:76", "[createGroup] current avatar.value=", avatar.value);
            status.value = `群聊创建成功：${data.groupName} (ID: ${data.groupId})`;
            if (avatarUploadPath.value) {
              uploadGroupAvatar(data.groupId, avatarUploadPath.value);
            }
          } else {
            common_vendor.index.__f__("warn", "at pages/create-group/create-group.vue:84", "[createGroup] failed", data);
            status.value = "创建失败: " + (data.reason || "未知错误");
          }
        })
      );
    }
    function uploadGroupAvatar(groupId, localPath) {
      const token = common_vendor.index.getStorageSync("token") || "";
      common_vendor.index.uploadFile({
        url: UPLOAD_URL,
        filePath: localPath,
        name: "file",
        header: { Authorization: token ? `Bearer ${token}` : "" },
        success: (uploadRes) => {
          try {
            const data = JSON.parse(uploadRes.data);
            if (data && data.result === "ok" && data.url) {
              updateGroupAvatar(groupId, data.url);
            } else {
              common_vendor.index.showToast({ icon: "none", title: "上传失败" });
            }
          } catch (e) {
            common_vendor.index.__f__("error", "at pages/create-group/create-group.vue:108", "upload parse error", e);
          }
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/create-group/create-group.vue:112", "uploadFile fail", err);
          common_vendor.index.showToast({ icon: "none", title: "上传失败" });
        }
      });
    }
    function updateGroupAvatar(groupId, newUrl) {
      common_vendor.index.request({
        url: "http://172.21.67.11:8080/api/user/updateGroupAvatar",
        method: "POST",
        header: {
          Authorization: `Bearer ${common_vendor.index.getStorageSync("token")}`
        },
        data: { groupId, avatar: newUrl },
        success: (res) => {
          if (res.data.result === "ok") {
            common_vendor.index.showToast({ icon: "success", title: "头像已更新" });
            store.dispatch("groups/loadGroups", true);
          } else {
            common_vendor.index.showToast({ icon: "none", title: res.data.message || "更新失败" });
          }
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/create-group/create-group.vue:136", "update avatar fail", err);
        }
      });
    }
    common_vendor.onShow(() => {
      store.dispatch("groups/loadGroups");
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: avatar.value || defaultAvatar,
        b: common_vendor.o(chooseAvatar),
        c: groupName.value,
        d: common_vendor.o(($event) => groupName.value = $event.detail.value),
        e: membersText.value,
        f: common_vendor.o(($event) => membersText.value = $event.detail.value),
        g: common_vendor.o(handleCreateGroup),
        h: status.value
      }, status.value ? {
        i: common_vendor.t(status.value)
      } : {});
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-c3f8f667"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/create-group/create-group.js.map
