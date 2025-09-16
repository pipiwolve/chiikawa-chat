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
    <view v-for="(req, index) in list" :key="index" class="request-card">
      <image class="avatar" :src="req.avatar || defaultAvatar"></image>
      <view class="info">
        <text class="username">{{ req.username || req.fromUser }}</text>
        <!-- 主行只放缩写 -->
        <text class="message">申请加入群聊 {{ shortId(req.groupId) }}</text>
        <!-- 点击可复制完整 ID -->
        <text class="id-more" @click="copyId(req.groupId)">完整ID·点我复制</text>
      </view>
      <button class="accept-btn" @click="agreeRequest(req)">同意</button>
    </view>

    <!-- 空状态 -->
    <view v-if="list.length === 0" class="no-request">
      暂无群聊申请
    </view>
  </view>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import { sendCmdMessage } from '@/utils/socket.js'

export default {
  data() {
    return {
      userId: ''                 // ✅ 1. 补上 userId
    }
  },

  computed: {
    ...mapState('groupRequests', ['list']),
    defaultAvatar: () => '/static/default-avatar/helanzhu.png'
  },

  methods: {
    ...mapActions('groupRequests', ['loadList']),

    /* 兜底拉取：把当前用户ID传进去 */
    loadRequests() {
      this.loadList({ userId: this.userId })   // ✅ 2. 带参调用
    },

    agreeRequest(req) {
      sendCmdMessage(210, {
        fromUser: this.userId,   // ✅ 用本页 data 里的 userId
        applicant: req.fromUser,
        groupId: req.groupId
      })
      uni.showToast({ title: '已同意申请', icon: 'success' })

      // 本地移除（操作 Vuex）
      this.$store.commit('groupRequests/REMOVE_ONE', req.fromUser)
    },

    shortId(id) {
      return id ? id.slice(0, 8) + '…' : ''
    },
    copyId(id) {
      uni.setClipboardData({ data: id })
    },
    gotoGroups() {
      uni.navigateTo({ url: '/pages/groups/groups' })
    }
  },

  onLoad() {
    this.userId = uni.getStorageSync('currentUserId') || ''   // ✅ 读取
    this.loadRequests()                                       // 首次拉取
  },

  onShow() {
    this.loadRequests()   // ✅ 生命周期：切回来兜底
  }
}
</script>

<style lang="scss" scoped>
/* ================ 视觉变量 ================ */
$theme-start: rgba(10, 9, 9, 0.99);
$theme-end: rgba(10, 9, 9, 0.7);
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

/* ================ 群聊申请卡片 ================ */
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
    flex: 1; // 占据剩余空间
    min-width: 0; // 关键：允许压缩
    display: flex;
    flex-direction: column;
    margin-right: 24rpx; // 与按钮间隙
  }
    .username {
      font-size: 32rpx;
      font-weight: 600;
      color: $text-title;
    }

    .message {
      font-size: 26rpx;
      color: $text-desc;
      margin-top: 6rpx;
      white-space: nowrap; // 1. 不换行
      overflow: hidden; // 2. 溢出隐藏
      text-overflow: ellipsis; // 3. 省略号
    }

    .id-more {
      font-size: 22rpx;
      color: $theme-start;
      margin-top: 4rpx;
    }



  /* 渐变同意按钮 */
  .accept-btn {
    width: 96rpx;
    height: 64rpx;
    flex-shrink: 0;   // 关键：禁止缩小
    font-size: 24rpx;      /* 比原来小一点 */
    padding: 0;            /* 去掉默认内边距 */
    line-height: 64rpx;    /* 行高 = 按钮高，垂直居中 */
    text-align: center;    /* 水平居中 */
    border: none;
    border-radius: 12rpx;
    background: linear-gradient(135deg, $theme-start, $theme-end);
    color: #fff;
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