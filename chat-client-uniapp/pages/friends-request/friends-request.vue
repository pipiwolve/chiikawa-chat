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

<style lang="scss" scoped>
/* ================ 视觉变量 ================ */
$theme-start: #07c160;
$theme-end: #05a14a;
$bg: #f7f8fc;
$card: #ffffff;
$radius: 24rpx;
$shadow: 0 8rpx 30rpx rgba(0, 0, 0, .06);
$text-title: #1f2937;
$text-desc: #6b7280;
$ease: cubic-bezier(.4, .8, .2, 1);

/* ================ 页面骨架 ================ */
.page {
background: $bg;
min-height: 100vh;
padding: 40rpx;
box-sizing: border-box;
}

/* ================ 功能卡片 ================ */
.function-list {
background: $card;
border-radius: $radius;
box-shadow: $shadow;
overflow: hidden;
margin-bottom: 30rpx;
}

.function-item {
display: flex;
align-items: center;
padding: 30rpx;
border-bottom: 2rpx solid #f2f2f2;
transition: background-color .2s $ease;
&:last-child {
border-bottom: none;
}
&:active {
background-color: #f8f8f8;
}
}

.icon {
width: 48rpx;
height: 48rpx;
margin-right: 24rpx;
}

.label {
font-size: 30rpx;
color: $text-title;
}

/* ================ 申请卡片 ================ */
.request-card {
display: flex;
align-items: center;
background: $card;
border-radius: $radius;
box-shadow: $shadow;
padding: 24rpx;
margin-bottom: 16rpx;
transition: transform .15s $ease;
&:active {
transform: scale(.98);
}

.avatar {
width: 88rpx;
height: 88rpx;
border-radius: 50%;
margin-right: 24rpx;
flex-shrink: 0;
/* 黑边防遮挡 */
//border: 4rpx solid #000;
box-sizing: border-box;
}

.info {
flex: 1;
display: flex;
flex-direction: column;
.username {
font-size: 32rpx;
font-weight: 600;
color: $text-title;
}
.message {

font-size: 26rpx;
color: $text-desc;
margin-top: 6rpx;

}
}

/* 渐变同意按钮 */
.accept-btn {
width: 112rpx;
height: 64rpx;
border: none;
border-radius: 12rpx;
background: linear-gradient(135deg, $theme-start, $theme-end);
color: #fff;
font-size: 28rpx;
font-weight: 600;
display: flex;
align-items: center;
justify-content: center;
box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, .3);
transition: transform .15s $ease;
&:active {
transform: scale(.92);
}
}
}

/* ================ 空状态 ================ */
.no-request {
margin-top: 60rpx;
text-align: center;
font-size: 28rpx;
color: $text-desc;
}
</style>