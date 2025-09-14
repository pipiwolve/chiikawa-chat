<template>
  <image class="bg-image" src="/static/background/session.jpg" mode="aspectFill"/>
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
        <view class="txt">{{ formatLastMsg(item) || '暂无消息' }}</view>
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
      defaultAvatar: '/static/default-avatar/xiaoqi.png',
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


    registerCmdHandler(101, (data) => {
      // 收到已读回执 → 会话的未读数可能已变，刷新 sessions
      this.loadSessions();
    });

    // 群聊相关回调
    registerCmdHandler(201, () => this.loadSessions()) // 加群成功
    registerCmdHandler(203, () => this.loadSessions()) // 创建群成功
    registerCmdHandler(204, () => this.loadSessions()) // 被拉入群

    // ✅ 监听全局 sessionsUpdated 事件
    uni.$on("sessionsUpdated", (resp) => {
      console.log('[sessions.vue] 收到 sessionsUpdated:', resp)
      this.users = (resp.sessions || []).map(s => ({
        ...s,
        hasUnread: (s.unread || 0) > 0 || (s.pendingFriendRequest || false)
      }))
    })


    uni.$on('clearUnread', this.loadSessions)
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
    uni.$off('clearUnread', this.loadSessions)
    uni.$off("sessionsUpdated")


    // 注销 WebSocket 回调
    unregisterCmdHandler(205)
    unregisterCmdHandler(207)
    unregisterCmdHandler(201)
    unregisterCmdHandler(203)
    unregisterCmdHandler(204)
    unregisterCmdHandler(101)
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
      let query = `?targetId=${item.sessionId}&type=${item.type}&name=${item.nickname}`
      uni.navigateTo({
        url: '/pages/chat/chat' + query
      })
    },

    formatLastMsg(item) {
      if (!item) return '暂无消息'
      if (item.messageType === 'image') {
        return '[图片]'
      } else if (item.messageType === 'voice') {
        return '[语音]'
      } else {
        return item.lastMsg || '暂无消息'
      }
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
/* ================ 视觉变量 ================ */
$theme: #07c160;
$bg: #f7f8fc;
$card: #ffffff;
$radius: 24rpx;
$shadow: 0 8rpx 30rpx rgba(0, 0, 0, .06);
$text-title: #1f2937;
$text-desc: #6b7280;
$ease: cubic-bezier(.4, .8, .2, 1);

/* ================ 背景图 ================ */
.bg-image {
position: fixed;
left: 0;
top: 0;
width: 100%;
height: 100%;
z-index: -1;
}

/* ================ 页面骨架 ================ */
.page {
background: transparent; // 让背景图透出
min-height: 100vh;
padding: 40rpx;
box-sizing: border-box;
}

/* ================ 会话卡片 ================ */
.list-item {
display: flex;
align-items: center;
padding: 24rpx;
margin-bottom: 16rpx;
background: $card;
border-radius: $radius;
box-shadow: $shadow;
transition: transform .15s $ease;
&:active {
transform: scale(.98);
}

/* 头像容器 */
.avatar {
width: 96rpx;
height: 96rpx;
margin-right: 24rpx;
position: relative;
flex-shrink: 0;

/* 黑边防遮挡 */
image {
width: 100%;
height: 100%;
border-radius: 50%;
//border: 4rpx solid #000;
box-sizing: border-box;
}

/* 未读红点 → 带数字小徽章 */
.round {
position: absolute;
top: -8rpx;
right: -8rpx;
min-width: 32rpx;
height: 32rpx;
line-height: 32rpx;
padding: 0 8rpx;
border-radius: 16rpx;
background: #ef5656;
color: #fff;
font-size: 22rpx;
text-align: center;
z-index: 1;
}
}

/* 右侧内容 */
.content {
flex: 1;
display: flex;
flex-direction: column;

.title {
display: flex;
justify-content: space-between;
align-items: baseline;
margin-bottom: 8rpx;

.name {
font-size: 32rpx;
font-weight: 600;
color: $text-title;
}
.time {
font-size: 24rpx;
color: $text-desc;
}
}

.txt {
font-size: 26rpx;
color: $text-desc;
overflow: hidden;
text-overflow: ellipsis;
display: -webkit-box;
-webkit-line-clamp: 1;
-webkit-box-orient: vertical;
}
}
}

</style>