<template>
  <image class="bg-image" src="/static/background/myself.jpg" mode="aspectFill"/>
  <view class="myself-container">
    <!-- 头像 -->
    <view class="avatar-section" @click="chooseAvatar">
      <image :src="avatar || defaultAvatar" class="avatar" mode="aspectFill" />
      <text class="change-tip">点击更换头像</text>
    </view>

    <!-- 基本信息 -->
    <view class="info-section">
      <view class="info-item">
        <text class="label">用户ID：</text>
        <text class="value">{{ userId }}</text>
      </view>
      <view class="info-item">
        <text class="label">用户名：</text>
        <text class="value">{{ username }}</text>
      </view>
    </view>
  </view>
</template>

<script>
const UPLOAD_URL = "http://172.21.67.11:8080/api/upload"; // 上传接口

export default {
  data() {
    return {
      userId: uni.getStorageSync("currentUserId") || "",
      username: uni.getStorageSync("currentUserName") || "",
      avatar: uni.getStorageSync("currentUserAvatar") || "",
      defaultAvatar: "/static/default-avatar/wusaqi.png"
    };
  },

  methods: {
    /** 选择头像并上传 */
    chooseAvatar() {
      uni.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: (res) => {
          const localPath = res.tempFilePaths[0];
          const token = uni.getStorageSync("token") || "";

          // 上传文件到后端
          uni.uploadFile({
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
                  // 本地缓存更新
                  uni.setStorageSync("currentUserAvatar", data.url);
                  // 你可以在这里调用后端接口更新用户资料
                  this.updateProfileAvatar(data.url);
                } else {
                  uni.showToast({ icon: "none", title: "上传失败" });
                }
              } catch (e) {
                console.error("upload parse error", e);
              }
            },
            fail: (err) => {
              console.error("uploadFile fail", err);
              uni.showToast({ icon: "none", title: "上传失败" });
            }
          });
        }
      });
    },

    /** 更新资料到后端 */
    updateProfileAvatar(newUrl) {
      uni.request({
        url: "http://172.21.67.11:8080/api/user/updateAvatar",
        method: "POST",
        header: {
          Authorization: `Bearer ${uni.getStorageSync("token")}`
        },
        data: {
          userId: this.userId,
          avatar: newUrl
        },
        success: (res) => {
          if (res.data.result === "ok") {
            uni.showToast({ icon: "success", title: "头像已更新" });
          } else {
            uni.showToast({ icon: "none", title: res.data.message || "更新失败" });
          }
        },
        fail: (err) => {
          console.error("update avatar fail", err);
        }
      });
    }
  }
};
</script>

<style lang="scss">

/* 1. 全屏背景图（小程序安全写法） */
.bg-image {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

/* ========== 视觉变量（换主题只改这里） ========== */
:root {
--theme-color: #6366f1;      /* 主色 */
--bg-color: #f7f8fc;         /* 页面背景 */
--card-bg: #ffffff;          /* 卡片背景 */
--radius: 24rpx;             /* 圆角统一 */
--shadow: 0 8rpx 30rpx rgba(0,0,0,.06);
--text-title: #1f2937;
--text-desc: #6b7280;
--ease: cubic-bezier(.4,.8,.2,1);
}

/* ========== 页面整体 ========== */
.myself-container {
background: var(--bg-color);
min-height: 100vh;
padding: 60rpx 40rpx;
box-sizing: border-box;
}

/* ========== 头像区域 ========== */
.avatar-section {
position: relative;
margin-bottom: 60rpx;
}

.avatar {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: #f2f2f2;

  /* 黑边突出 */
  border: 6rpx solid #000;   /* 粗细可自己调 */
  box-sizing: border-box;    /* 保证尺寸不变 */
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,.15); /* 可选：一点投影更立体 */
}
.avatar-section:active .avatar {
transform: scale(.96);
}

.change-tip {
margin-top: 16rpx;
font-size: 26rpx;
color: var(--text-desc);
letter-spacing: .5rpx;
}

/* ========== 信息卡片 ========== */
.info-section {
width: 100%;
background: var(--card-bg);
border-radius: var(--radius);
box-shadow: var(--shadow);
padding: 40rpx;
box-sizing: border-box;
}

.info-item {
display: flex;
align-items: center;
margin-bottom: 36rpx;
}
.info-item:last-child {
margin-bottom: 0;
}

.label {
flex-shrink: 0;
width: 160rpx;
font-size: 30rpx;
color: var(--text-desc);
}

.value {
flex: 1;
font-size: 32rpx;
color: var(--text-title);
font-weight: 500;
margin-left: 20rpx;
padding: 12rpx 20rpx;
background: #f3f4f6;
border-radius: 12rpx;
word-break: break-all;
}
</style>