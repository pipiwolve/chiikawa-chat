<template>
  <view class="chat-container">
    <!-- 右侧消息区 -->
    <view class="chat-right">
      <!-- 顶部标题 -->
      <view class="chat-header">{{ currentTargetName }}</view>

      <!-- 消息列表 -->
      <scroll-view
          scroll-y
          class="msg-list"
          :scroll-top="scrollTop"
          @scrolltoupper="loadMoreMessages"
          scroll-with-animation
      >
        <view
            v-for="(item, index) in currentMessages"
            :key="item.msgId || index"
            :class="[
            'msg-item',
            item.fromUser === userId ? 'msg-sent' : 'msg-received',
            item.isOffline ? 'offline-msg' : '',
            item.status === 'sending' ? 'msg-sending' : '',
            item.status === 'failed' ? 'msg-failed' : '',
            item.status === 'isRead' && item.fromUser === userId && item.type === 'private'
              ? 'msg-isRead'
              : ''
          ]"
        >
          <view class="msg-nickname">{{ item.nickname || item.fromUser }}</view>
          <view class="msg-content">{{ item.content }}</view>
          <view class="msg-timestamp">{{ formatTimestamp(item.timestamp) }}</view>

          <!-- 私聊状态 -->
          <view v-if="item.fromUser === userId && item.type === 'private'" class="msg-status">
            <text v-if="item.status === 'sending'">发送中...</text>
            <text v-else-if="item.status === 'failed'">
              <button @click="retrySend(item)">重试</button>
            </text>
            <text v-else-if="item.status === 'success'">未读</text>
            <text v-else-if="item.status === 'isRead'">已读</text>
          </view>
        </view>

        <view v-if="loadingHistory" class="loading-tip">加载中...</view>
      </scroll-view>

      <!-- 输入栏固定底部 -->
      <view class="chat-input-bar">
        <input v-model="inputMsg" placeholder="输入消息..." class="msg-input" />
        <button @click="sendMsg">发送</button>
      </view>
    </view>
  </view>
</template>

<script>
import {
  connectSocket,
  sendMsg,
  sendGroupMsg,
  isConnected,
  closeSocket,
  setReadAckHandler,
  sendReadAck,
  sendGroupCursor,
  setGroupHistoryHandler,
  sendGroupHistoryRequest,
  onPrivateMessage,
  onGroupMessage,
  unregisterCmdHandler,
  fetchOfflinePrivateMessages
} from '@/utils/socket.js'

export default {
  data() {
    return {
      messages: [],
      groupMessages: {},
      inputMsg: '',
      userId: '',
      targetId: '',
      targetType: '',
      currentTargetName: '',
      currentTargetAvatar: '',
      connectionStatus: '未连接',
      scrollTop: 0,
      msgStatusMap: {},
      unreadMsgIdsBuffer: [],
      unreadMsgIdsTimer: null,

      groupPageNum: 1,
      groupPageSize: 20,
      groupHasMore: true,
      loadingHistory: false
    }
  },

  onLoad(options) {
    console.log('进入聊天页:', options)
    this.userId = uni.getStorageSync('currentUserId') || ''
    this.targetId = options.targetId
    this.targetType = options.type
    this.currentTargetName = options.name || ''
    this.currentTargetAvatar = options.avatar || ''

    this.connectionStatus = '连接中...'

    // 注册已读/群历史
    setReadAckHandler(msgIds => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]))
    setGroupHistoryHandler(arr => {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false
        return
      }
      this.mergeGroupHistory(arr)
    })

    if (this.targetType === 'private') {
      // 拉取私聊离线消息
      fetchOfflinePrivateMessages(this.targetId, (offlineMsgs) => {
        if (Array.isArray(offlineMsgs)) {
          offlineMsgs.forEach(m => this.messages.push({...m, isOffline: true, status: 'success'}))
          // 发送已读 ack 防抖
          const unreadIds = offlineMsgs.filter(m => m.fromUser === this.targetId).map(m => m.msgId)
          if (unreadIds.length > 0) this.collectUnreadMsgIds(unreadIds)
          this.$nextTick(() => { this.scrollTop = 100000 })
        }
      })
    }

    // 建立 socket
    connectSocket(this.userId, msg => {
      console.log("[WS] 收到消息:", msg)
    })

    onPrivateMessage(msg => this.handleSocketMessage(msg))
    onGroupMessage(msg => this.handleSocketMessage(msg))



    if (this.targetType === 'group') {
      sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize)
    }

    setInterval(() => {
      this.connectionStatus = isConnected() ? '已连接' : '未连接'
    }, 1000)
  },

  onUnload() {
    unregisterCmdHandler(2) // 避免重复注册
    unregisterCmdHandler(3)
  },

  methods: {
    /** 处理 socket 收到的消息 */
    handleSocketMessage(msg) {
      console.log("进入 handleSocketMessage:", msg)

      // 私聊消息
      if (msg.type === 'private' &&
          ((msg.fromUser === this.targetId && msg.toUser === this.userId) ||
              (msg.fromUser === this.userId && msg.toUser === this.targetId))) {

        const existingIdx = this.messages.findIndex(m => m.msgId === msg.msgId)
        if (existingIdx !== -1) {
          this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg }
        } else {
          this.messages.push({ ...msg, isOffline: false, status: msg.status || 'success' })
        }

        // 收集未读回执
        if (msg.fromUser !== this.userId) {
          this.collectUnreadMsgIds([msg.msgId])
        }

        this.$nextTick(() => { this.scrollTop = 100000 })
        return
      }

      // 群聊消息
      if (msg.type === 'group') {
        const gid = msg.groupId
        if (!gid) return
        if (!this.groupMessages[gid]) this.$set(this.groupMessages, gid, [])
        const exists = this.groupMessages[gid].some(m => m.msgId === msg.msgId)
        if (!exists) this.groupMessages[gid].push({ ...msg, isOffline: false })

        if (this.targetType === 'group' && this.targetId === gid) {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1]
            this.debounceSendGroupCursor(gid, last?.msgId)
            this.scrollTop = 100000
          })
        }
      }
    },

    /** 发送消息 */
    sendMsg() {
      if (!this.inputMsg.trim()) return

      const msg = {
        msgId: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        fromUser: this.userId,
        toUser: this.targetId,
        content: this.inputMsg,
        timestamp: Date.now(),
        type: this.targetType,
        status: 'sending'
      }

      const onStatusChange = (status) => {
        msg.status = status
        this.msgStatusMap[msg.msgId] = status
      }

      if (this.targetType === 'private') {
        sendMsg(msg, onStatusChange)
        this.messages.push(msg) // 本地立即显示
      } else {
        msg.groupId = this.targetId
        sendGroupMsg(msg, onStatusChange)
        if (!this.groupMessages[this.targetId]) this.$set(this.groupMessages, this.targetId, [])
        this.groupMessages[this.targetId].push(msg)
      }

      this.inputMsg = ''
      this.$nextTick(() => { this.scrollTop = 100000 })
    },

    /** 已读回执 */
    handleReadAck(msgIds) {
      msgIds.forEach(msgId => {
        const msg = this.messages.find(m => m.msgId === msgId)
        if (msg && msg.fromUser === this.userId && msg.status === 'success' && msg.type === 'private') {
          msg.status = 'isRead'
          this.msgStatusMap[msgId] = 'isRead'
        }
      })
    },

    /** 收集未读消息 ID，延迟发送已读回执 */
    collectUnreadMsgIds(ids) {
      console.log("收集未读ID:", ids)
      this.unreadMsgIdsBuffer.push(...ids)
      if (this.unreadMsgIdsTimer) clearTimeout(this.unreadMsgIdsTimer)
      this.unreadMsgIdsTimer = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBuffer))
        if (uniqueIds.length > 0) sendReadAck(uniqueIds)
        this.unreadMsgIdsBuffer = []
        this.unreadMsgIdsTimer = null
      }, 300)
    },

    /** 滚动加载群历史消息 */
    loadMoreMessages() {
      if (this.targetType !== 'group' || !this.groupHasMore) return
      const groupId = this.targetId
      const pageNum = this.groupPageNum + 1
      sendGroupHistoryRequest(groupId, pageNum, this.groupPageSize)
      this.groupPageNum = pageNum
    },

    /** 工具方法 */
    disconnect() { closeSocket() },
    formatTimestamp(ts) {
      if (!ts) return ''
      let dateObj

      if (typeof ts === 'string') {
        // 处理 iOS 不兼容 "yyyy-MM-dd HH:mm:ss"
        if (ts.includes('-') && ts.includes(':') && ts.includes(' ')) {
          ts = ts.replace(/-/g, '/')
        }
        dateObj = new Date(ts)
      } else {
        dateObj = new Date(ts)
      }

      if (isNaN(dateObj.getTime())) return '' // 避免 Invalid Date

      const h = String(dateObj.getHours()).padStart(2, '0')
      const m = String(dateObj.getMinutes()).padStart(2, '0')
      const s = String(dateObj.getSeconds()).padStart(2, '0')
      return `${h}:${m}:${s}`
    },

    retrySend(msg) {
      msg.status = 'sending'
      if (msg.type === 'private') sendMsg(msg)
      else sendGroupMsg(msg)
    },

    /** 合并群聊历史 */
    mergeGroupHistory(arr) {
      arr.forEach(m => {
        if (!this.groupMessages[m.groupId]) this.$set(this.groupMessages, m.groupId, [])
        this.groupMessages[m.groupId].unshift(m)
      })
    },

    /** 防抖上报群游标 */
    debounceSendGroupCursor: (function () {
      let timer = null
      return function (gid, msgId) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          sendGroupCursor(gid, msgId)
          timer = null
        }, 500)
      }
    })()
  },

  computed: {
    currentMessages() {
      if (this.targetType === 'private') {
        return this.messages.filter(m =>
            (m.fromUser === this.targetId && m.toUser === this.userId) ||
            (m.fromUser === this.userId && m.toUser === this.targetId)
        )
      } else {
        return this.groupMessages[this.targetId] || []
      }
    }
  }
}
</script>

<style>
.chat-container {
  display: flex;
  height: 100vh;
}

.chat-right {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.chat-header {
  height: 50px;
  line-height: 50px;
  background: #f7f7f7;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 10px;
  font-weight: bold;
}

.msg-list {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  background-color: #fff;
}

.msg-item {
  margin: 5px 0;
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 10px;
  word-wrap: break-word;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-bottom: 18px;
}

/* 自己发的消息右对齐 */
.msg-sent {
  align-self: flex-end;
  background-color: #DCF8C6;
}

/* 对方消息左对齐 */
.msg-received {
  align-self: flex-start;
  background-color: #FFF;
  border: 1px solid #ddd;
}

.msg-status {
  position: absolute;
  bottom: 2px;
  right: 8px;
  font-size: 11px;
  color: #888;
  display: flex;
  align-items: center;
}

.chat-input-bar {
  display: flex;
  height: 50px;
  border-top: 1px solid #e0e0e0;
  background: #f9f9f9;
  align-items: center;
  padding: 0 10px;
}

.msg-input {
  flex: 1;
  border: 1px solid #ccc;
  border-radius: 20px;
  padding: 5px 10px;
}

.chat-input-bar button {
  margin-left: 10px;
  padding: 5px 15px;
  border-radius: 4px;
  background-color: #2e89ff;
  color: #fff;
}
</style>