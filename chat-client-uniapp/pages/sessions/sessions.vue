<template>
  <view class="page">
    <view
        class="list-item"
        v-for="(item, index) in users"
        :key="index"
        @click="connect(item)"
    >
      <view class="avatar">
        <text class="round" v-if="item.unread > 0">{{ item.unread }}</text>
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
import { connectSocket } from '@/utils/socket.js'

export default {
  data() {
    return {
      userId: '',
      users: [], // 最近会话列表
      defaultAvatar: '/static/default-avatar.png',
      socketConnected: false,
      socketTask: null
    }
  },
  onLoad(options) {
    this.userId = options.userId || ''
    if (!this.userId) return

    // 建立 WebSocket 连接
    this.socketTask = connectSocket(this.userId, this.handleWSMessage)
  },
  methods: {
    // WebSocket 消息回调
    handleWSMessage(msg) {
      console.log('[WS] 收到消息:', msg)
      // 最近会话列表返回
      if (Array.isArray(msg) && msg.length && msg[0].sessionId) {
        this.users = msg
      }
    },

    // 发送 cmd=200 请求最近会话
    fetchSessions() {
      const data = {cmd: 200, fromUser: this.userId}
      if (this.socketTask && this.socketConnected) {
        try {
          this.socketTask.send({
            data: JSON.stringify(data),
            success: () => console.log('[WS] 请求最近会话成功'),
            fail: (err) => console.error('[WS] 请求失败', err)
          })
        } catch (e) {
          console.error('[WS] 发送异常', e)
        }
      }
    },

    // 点击跳转到聊天页面
    connect(item) {
      let query = ''
      if (item.type === 'private') {
        query = `?targetId=${item.sessionId}&type=private`
      } else if (item.type === 'group') {
        query = `?targetId=${item.sessionId}&type=group`
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
  },
  onShow() {
    // 页面显示时请求最近会话
    this.fetchSessions()
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
      width: 22rpx;
      height: 22rpx;
      border-radius: 50%;
      background: #ef5656;
      color: #fff;
      font-size: 18rpx;
      line-height: 22rpx;
      text-align: center;
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