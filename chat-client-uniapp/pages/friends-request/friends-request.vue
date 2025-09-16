<template>
  <view class="page">

    <view class="function-list">

      <view class="function-item" @click="gotoAddFriend">
        <image class="icon" src="/static/icons/add-friend.png"></image>
        <text class="label">添加好友</text>
      </view>

    </view>

    <view v-for="(req, index) in list" :key="index" class="request-card">
      <image class="avatar" :src="req.avatar || defaultAvatar"></image>
      <view class="info">
        <text class="username">{{ req.username || req.fromUser }}</text>
        <text class="message">{{ req.message || '请求加你为好友' }}</text>
      </view>
      <button class="accept-btn" @click="respond(req.fromUser, 'accept')">同意</button>
    </view>

    <view v-if="list.length === 0" class="no-request">
      暂无好友申请
    </view>
  </view>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
  data() {
    return {
      userId: ''               // ✅ 1. 当前用户 ID
    }
  },

  computed: {
    ...mapState('friendRequests', ['list']),
    defaultAvatar: () => '/static/default-avatar/yang.png'
  },

  methods: {
    ...mapActions('friendRequests', ['loadList', 'agree']),

    /* 兜底拉取：把 userId 传给 Vuex，后端需要 */
    loadRequests() {
      this.loadList({ userId: this.userId })   // ✅ 2. 带参
    },

    // 点击同意
    respond(fromUser) {
      this.agree({ fromUser, userId: this.userId }) // ✅ 3. 传参给 Vuex
    },

    gotoAddFriend() {
      uni.navigateTo({ url: '/pages/add-friend/add-friend' })
    }
  },

  onLoad() {
    this.userId = uni.getStorageSync('currentUserId') || ''  // ✅ 4. 读取
    this.loadRequests()                                      // 首次拉取
  },

  onShow() {
    this.loadRequests()   // ✅ 5. 生命周期兜底
  }
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