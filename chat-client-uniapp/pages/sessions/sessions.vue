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
        <text class="round" v-if="item.hasUnread > 0"></text>
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
import { fetchSessions, registerCmdHandler, unregisterCmdHandler } from '@/utils/socket.js'

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
    console.log('消息中心取到用户ID', this.userId)
    this.loadSessions()

    registerCmdHandler(205, (data) => {
      // data.fromUser 表示申请人
      uni.$emit("refreshFriendRequests")
      // 可在 sessions 页面显示红点
      uni.showToast({ title: `${data.fromUser} 申请加你为好友`, icon: "none" })
    })

    // 好友添加成功回调
    registerCmdHandler(207, (data) => {
      uni.showToast({ title: `你和 ${data.friendId} 已成为好友`, icon: 'success' })
      uni.$emit('refreshFriends')
      this.loadSessions()
    })

    // 群聊相关回调
    registerCmdHandler(201, () => this.loadSessions()) // 加群成功
    registerCmdHandler(203, () => this.loadSessions()) // 创建群成功
    registerCmdHandler(204, () => this.loadSessions()) // 被拉入群

    // 消息显示回调
    registerCmdHandler(2, () => this.loadSessions())
    registerCmdHandler(3, () => this.loadSessions())

    // ✅ 监听发送方主动触发的刷新
    uni.$on('refreshSessions', this.loadSessions)
    // 全局刷新事件订阅
    uni.$on('refreshFriends', this.loadSessions)
    uni.$on('refreshGroups', this.loadSessions)
  },

  onUnload() {
    // 避免重复绑定
    uni.$off('refreshFriends', this.loadSessions)
    uni.$off('refreshGroups', this.loadSessions)
    uni.$off('refreshSessions', this.loadSessions)

    // 注销 WebSocket 回调
    unregisterCmdHandler(205)
    unregisterCmdHandler(207)
    unregisterCmdHandler(201)
    unregisterCmdHandler(203)
    unregisterCmdHandler(204)
    unregisterCmdHandler(2)
    unregisterCmdHandler(3)
  },

  methods: {
    // 获取最近会话（cmd=200）
    loadSessions() {
      fetchSessions((resp) => {
        console.log('[Sessions] 最近会话:', resp.sessions)
        this.users = (resp.sessions || []).map(s => ({
          ...s,
          // 标记未读：未读消息或存在待处理好友请求
          hasUnread: (s.unread || 0) > 0 || (s.pendingFriendRequest || false)
        }))
      })
    },
    // 点击会话进入聊天
    connect(item) {
      let query = `?targetId=${item.sessionId}&type=${item.type}`
      uni.navigateTo({
        url: '/pages/chat/chat' + query
      })
    },
    // 格式化时间
    formatTime(ts) {
      if (!ts) return ''

      let dateObj
      if (typeof ts === 'string') {
        // 替换空格为 T，或者替换 - 为 /
        const normalized = ts.replace(/-/g, '/').replace(' ', 'T')
        dateObj = new Date(normalized)
      } else {
        dateObj = new Date(ts)
      }

      if (isNaN(dateObj.getTime())) return '' // 避免 NaN

      const hours = dateObj.getHours().toString().padStart(2, '0')
      const minutes = dateObj.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
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