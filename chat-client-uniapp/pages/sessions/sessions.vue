<template>
  <view class="page">
    <!-- 最近会话列表 -->
    <view
        class="list-item"
        v-for="(item,index) in users"
        :key="index"
        @click="connect(item)"
    >
      <view class="avatar">
        <text class="round" v-if="item.unread > 0"></text>
        <image :src="item.avatar || defaultAvatar" mode="widthFix"></image>
      </view>
      <view class="content">
        <view class="title">
          <text class="name">{{ item.nickname || item.name }}</text>
          <text class="time">{{ formatTime(item.lastTime) }}</text>
        </view>
        <view class="txt">{{ item.lastMsg || '暂无消息' }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import { fetchSessions, registerCmdHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      users: [],
      defaultAvatar: '/static/default-avatar/helanzhu.png',
      userId: ''
    }
  },
  onLoad() {
    this.userId = uni.getStorageSync('currentUserId') || ''
    this.loadSessions()

    registerCmdHandler(205, (data) => {
      // data.fromUser 表示申请人
      uni.$emit("refreshFriendRequests")
      // 可在 sessions 页面显示红点
      uni.showToast({ title: `${data.fromUser} 申请加你为好友`, icon: "none" })
    })
  },

  methods: {
    // 获取最近会话（cmd=200）
    loadSessions() {
      fetchSessions((resp) => {
        console.log('最近会话:', resp.sessions)
        this.users = resp.sessions || []
      })
    },
    // 点击会话进入聊天
    connect(item) {
      let query = ''
      if (item.userId) {
        query = `?targetId=${item.userId}&type=private`
      } else if (item.groupId) {
        query = `?targetId=${item.groupId}&type=group`
      }
      uni.navigateTo({
        url: '/pages/chat/chat' + query
      })
    },
    // 格式化时间
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 0 32rpx;
  color: #333;
}

.list-item {
  display: flex;
  padding: 30rpx 0;
  border-bottom: 1px solid #f7f8f9;
  .avatar {
    width: 90rpx;
    height: 90rpx;
    border-radius: 10rpx;
    margin-right: 20rpx;
    position: relative;
    .round {
      position: absolute;
      width: 14rpx;
      height: 14rpx;
      border-radius: 50%;
      background: #ef5656;
      top: -4rpx;
      right: -4rpx;
      z-index: 1;
    }
    image {
      width: 100%;
      height: 100%;
      border-radius: 10rpx;
    }
  }
  .content {
    flex: 1;
    .title {
      display: flex;
      justify-content: space-between;
      .name {
        font-weight: bold;
      }
      .time {
        color: #999;
        font-size: 24rpx;
      }
    }
    .txt {
      margin-top: 10rpx;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      text-align: left;
      color: #999;
      font-size: 26rpx;
    }
  }
}
</style>