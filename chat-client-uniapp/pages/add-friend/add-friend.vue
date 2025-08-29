<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">好友用户名</text>
        <input v-model="toUserId" placeholder="请输入好友用户名" class="input"/>
      </view>

      <button class="submit-btn" @click="sendFriendRequest">➕ 发送好友请求</button>
    </view>

    <text v-if="status" class="status">{{ status }}</text>

  </view>
</template>


<script>
import { sendFriendRequest, registerCmdHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      toUserId: ''
    }
  },
  onLoad() {
    // 注册 cmd 回调
    registerCmdHandler(202, (data) => {
      if (data.result === "pending") {
        uni.showToast({title: "好友申请已发送", icon: "none"})
      } else if (data.result === "fail") {
        uni.showToast({title: "好友申请失败", icon: "none"})
      }
    })

  },
  methods: {
    sendFriendRequest() {
      if (!this.toUserId.trim()) {
        uni.showToast({title: '请输入好友用户名', icon: 'none'})
        return
      }
      sendFriendRequest(this.toUserId)
    }
  },
  onUnload() {
    registerCmdHandler(202, null)
    registerCmdHandler(207, null)
  }
}
</script>

<style scoped>
.page {
  padding: 30rpx;
  background: #f5f5f5;
  min-height: 100vh;
}
.form {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}
.form-item {
  margin-bottom: 20rpx;
}
.label {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
  display: block;
}
.input {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
}
.submit-btn {
  margin-top: 20rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  padding: 20rpx;
  border-radius: 12rpx;
}
.status {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #666;
}
</style>