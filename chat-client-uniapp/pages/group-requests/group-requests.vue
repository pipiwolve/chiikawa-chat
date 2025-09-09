<template>
  <view class="page">

    <!-- 功能入口，可以复用 -->
    <view class="function-list">
      <view class="function-item" @click="gotoGroups">
        <image class="icon" src="/static/icons/application.png"></image>
        <text class="label">我的群聊</text>
      </view>
    </view>

    <!-- 群聊申请卡片 -->
    <view v-for="(req, index) in requests" :key="index" class="request-card">
      <image class="avatar" :src="req.avatar || defaultAvatar"></image>
      <view class="info">
        <text class="username">{{ req.username || req.fromUser }}</text>
        <text class="message">申请加入群聊 {{ req.groupName || req.groupId }}</text>
      </view>
      <button class="accept-btn" @click="agreeRequest(req)">同意</button>
    </view>

    <!-- 空状态 -->
    <view v-if="requests.length === 0" class="no-request">
      暂无群聊申请
    </view>
  </view>
</template>

<script>
import { registerCmdHandler, unregisterCmdHandler, sendCmdMessage, fetchGroupRequests } from "@/utils/socket.js"

export default {
  data() {
    return {
      requests: [],
      userId: "",
     defaultAvatar: '/static/default-avatar/helanzhu.png'
    }
  },

  onLoad() {
    this.userId = uni.getStorageSync("currentUserId") || ""
    this.loadRequests()

    registerCmdHandler(215, (msg) => {
      console.log("[215] 群聊申请:", msg)
      this.requests = msg.requests || []
    })

    // 监听新申请 (cmd=208)
    registerCmdHandler(214, (msg) => {
      console.log("[214] 收到新的群聊申请:", msg)
      this.loadRequests()
    })
  },

  onUnload() {
    unregisterCmdHandler(214)
    unregisterCmdHandler(215)
  },

  methods: {
    /** 加载群聊申请 */
    loadRequests() {
      fetchGroupRequests((res) => {
        this.requests = res.requests || []
      })
    },

    refreshRequests() {
      this.loadRequests()
    },

    agreeRequest(req) {
      // 群主同意 → cmd=210
      sendCmdMessage(210, {
        fromUser: this.userId,
        applicant: req.fromUser,   // ✅ 只传字符串
        groupId: req.groupId
      })

      uni.showToast({ title: "已同意申请", icon: "success" })

      // 前端本地移除
      this.requests = this.requests.filter(r => !(r.fromUser === req.fromUser && r.groupId === req.groupId))

      // 通知群聊联系人页刷新
      uni.$emit("refreshGroups")
    },
    gotoGroups(){
      uni.navigateTo({url: "/pages/groups/groups"})
    },
  }
}
</script>

<style >
.page {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}
.page {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}
.function-list {
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
}
.function-item {
  display: flex;
  align-items: center;
  padding: 24rpx 20rpx;
  border-bottom: 1px solid #eee;
}
.function-item:last-child {
  border-bottom: none;
}
.icon {
  width: 48rpx;
  height: 48rpx;
  margin-right: 20rpx;
}
.label {
  font-size: 30rpx;
}

.request-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.info {
  flex: 1;
}

.username {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.message {
  font-size: 24rpx;
  color: #666;
  margin-top: 4rpx;
}

.accept-btn {
  background-color: #3c9cff;
  color: #fff;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
}

.no-request {
  text-align: center;
  color: #999;
  font-size: 26rpx;
  margin-top: 40rpx;
}
</style>