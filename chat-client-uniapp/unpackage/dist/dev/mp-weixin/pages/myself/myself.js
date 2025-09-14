"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const UPLOAD_URL = "http://172.21.67.11:8080/api/upload";
const _sfc_main = {
  data() {
    return {
      userId: common_vendor.index.getStorageSync("currentUserId") || "",
      username: common_vendor.index.getStorageSync("currentUserName") || "",
      avatar: common_vendor.index.getStorageSync("currentUserAvatar") || "",
      defaultAvatar: "/static/default-avatar/wusaqi.png"
    };
  },
  methods: {
    /** 选择头像并上传 */
    chooseAvatar() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: (res) => {
          const localPath = res.tempFilePaths[0];
          const token = common_vendor.index.getStorageSync("token") || "";
          common_vendor.index.uploadFile({
            url: UPLOAD_URL,
            filePath: localPath,
            name: "file",
            header: {
              Authorization: token ? `Bearer ${token}` : ""
            },
            success: (uploadRes) => {
              try {
                const data = JSON.parse(uploadRes.data);
                if (data && data.result === "ok" && data.url) {
                  this.avatar = data.url;
                  common_vendor.index.setStorageSync("currentUserAvatar", data.url);
                  this.updateProfileAvatar(data.url);
                } else {
                  common_vendor.index.showToast({ icon: "none", title: "上传失败" });
                }
              } catch (e) {
                common_vendor.index.__f__("error", "at pages/myself/myself.vue:68", "upload parse error", e);
              }
            },
            fail: (err) => {
              common_vendor.index.__f__("error", "at pages/myself/myself.vue:72", "uploadFile fail", err);
              common_vendor.index.showToast({ icon: "none", title: "上传失败" });
            }
          });
        }
      });
    },
    /** 更新资料到后端 */
    updateProfileAvatar(newUrl) {
      common_vendor.index.request({
        url: "http://172.21.67.11:8080/api/user/updateAvatar",
        method: "POST",
        header: {
          Authorization: `Bearer ${common_vendor.index.getStorageSync("token")}`
        },
        data: {
          userId: this.userId,
          avatar: newUrl
        },
        success: (res) => {
          if (res.data.result === "ok") {
            common_vendor.index.showToast({ icon: "success", title: "头像已更新" });
          } else {
            common_vendor.index.showToast({ icon: "none", title: res.data.message || "更新失败" });
          }
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/myself/myself.vue:100", "update avatar fail", err);
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_assets._imports_0$6,
    b: $data.avatar || $data.defaultAvatar,
    c: common_vendor.o((...args) => $options.chooseAvatar && $options.chooseAvatar(...args)),
    d: common_vendor.t($data.userId),
    e: common_vendor.t($data.username)
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/myself/myself.js.map
