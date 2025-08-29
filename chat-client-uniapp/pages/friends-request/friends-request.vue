<template>
  <view class="page">

    <view class="function-list">

      <view class="function-item" @click="gotoAddFriend">
        <image class="icon" src="/static/icons/add-friend.png"></image>
        <text class="label">添加好友</text>
      </view>

    </view>

    <view v-for="(req, index) in requests" :key="index" class="request-card">
      <image class="avatar" :src="req.avatar || defaultAvatar"></image>
      <view class="info">
        <text class="username">{{ req.username || req.fromUser }}</text>
        <text class="message">{{ req.message || '请求加你为好友' }}</text>
      </view>
      <button class="accept-btn" @click="respond(req.fromUser, 'accept')">同意</button>
    </view>

    <view v-if="requests.length === 0" class="no-request">
      暂无好友申请
    </view>
  </view>
</template>

<script>
import { fetchFriendRequests, respondFriendRequest, registerCmdHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      requests: [],
      defaultAvatar: '/static/default-avatar/yang.png'
    }
  },
  onLoad() {
    // 注册 cmd=205 回调，收到新好友申请时触发
    registerCmdHandler(205, (data) => {
      this.requests.unshift({
        fromUser: data.fromUser,
        username: data.username || data.fromUser,
        avatar: data.avatar || '',
        message: data.message || `${data.fromUser} 想加你为好友`
      })
    })

    // 获取当前未处理好友申请
    fetchFriendRequests((data) => {
      console.log("[Friends-Requests] 收到好友申请列表:", data)
      if (data.requests) {
        this.requests = data.requests.map(r => ({
          fromUser: r.fromUser,
          username: r.username || r.fromUser,
          avatar: r.avatar || '',
          message: r.message || `${r.fromUser} 想加你为好友`
        }))
      }
    })
  },
  onUnload() {
    // 清理回调，避免内存泄漏
    registerCmdHandler(205, null)
    registerCmdHandler(209, null)
  },

  methods: {
    respond(fromUser, action) {
      const currentUser = uni.getStorageSync("currentUserId")
      respondFriendRequest(fromUser, currentUser, action)      // 移除已处理请求
      this.requests = this.requests.filter(r => r.fromUser !== fromUser)
    },
    gotoAddFriend(){
      uni.navigateTo({url: "/pages/add-friend/add-friend"})
    }
  },


}
</script>

<style scoped>
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