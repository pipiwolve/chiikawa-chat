<template>
  <view class="chat-container">
    <view class="chat-right">
      <view class="chat-header">{{ currentTargetName }}</view>

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
  setReadAckHandler,
  sendReadAck,
  setGroupHistoryHandler,
  sendGroupHistoryRequest,
  onPrivateMessage,
  onGroupMessage,
  unregisterCmdHandler,
  isConnected,
  fetchOfflinePrivateMessages,
  sendReplayGroupHistoryRequest,
  sendGroupCursor,
  setReplayGroupHistoryHandler

} from '@/utils/socket.js'

export default {
  data() {
    return {
      privateMessages: {},   // { targetId: [msg1, msg2, ...] }
      groupMessages: {},     // { groupId: [msg1, msg2, ...] }
      inputMsg: '',
      msgStatusMap:{},
      userId: '',
      targetId: '',
      targetType: '',
      currentTargetName: '',
      currentTargetAvatar: '',
      connectionStatus: '未连接',
      scrollTop: 0,
      groupPageNum: 1,
      groupPageSize: 20,
      groupHasMore: true,
      loadingHistory: false,
      unreadMsgIdsBuffer: [],
      unreadMsgIdsTimer: null
    }
  },

  computed: {
    currentMessages() {
      if (this.targetType === 'private') {
        return this.privateMessages[this.targetId] || []
      } else if (this.targetType === 'group') {
        return this.groupMessages[this.targetId] || []
      }
      return []
    }
  },

  onLoad(options) {
    console.log('进入聊天页:', options)
    this.userId = uni.getStorageSync('currentUserId') || ''
    this.targetId = options.targetId
    this.targetType = options.type
    this.currentTargetName = options.name || ''
    this.currentTargetAvatar = options.avatar || ''

    if (this.targetType === 'private') this.$set(this.privateMessages, this.targetId, [])
    if (this.targetType === 'group') this.$set(this.groupMessages, this.targetId, [])

    // 注册已读回执 & 群历史回调
    setReadAckHandler(msgIds => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]))
    // 注册回调
    setGroupHistoryHandler(arr => {
      this.loadingHistory = false;
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
      this.$nextTick(() => { this.scrollTop = 100000 });
    });


    setReplayGroupHistoryHandler(arr => {
      if (!Array.isArray(arr) || arr.length === 0) return;
      this.mergeGroupHistory(arr); // merge 到 groupMessages
      this.$nextTick(() => { this.scrollTop = 100000 });
    });



    // 建立 socket
    connectSocket(this.userId, msg => console.log('[WS] 收到消息:', msg))
    onPrivateMessage(msg => this.handleSocketMessage(msg))
    onGroupMessage(msg => this.handleSocketMessage(msg))

    // 拉取私聊离线消息
    if (this.targetType === 'private') {
      fetchOfflinePrivateMessages(this.targetId, (offlineMsgs) => {
        if (Array.isArray(offlineMsgs)) {
          this.$set(this.privateMessages, this.targetId, offlineMsgs.map(m => ({ ...m, isOffline: true, status: 'success' })))
          const unreadIds = offlineMsgs.filter(m => m.fromUser === this.targetId).map(m => m.msgId)
          if (unreadIds.length > 0) this.collectUnreadMsgIds(unreadIds, this.targetId)
          this.$nextTick(() => { this.scrollTop = 100000 })
        }
      })
    }
    // 群聊初始化
    if (this.targetType === 'group') {
      this.groupPageNum = 1
      this.groupHasMore = true
      this.loadingHistory = true
      sendReplayGroupHistoryRequest(this.targetId)

      sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize)
    }

    this.connTimer = setInterval(() => {
      this.connectionStatus = isConnected() ? '已连接' : '未连接'
    }, 1000)
  },

  onUnload() {
    unregisterCmdHandler(2)
    unregisterCmdHandler(3)
    unregisterCmdHandler(103)
    setGroupHistoryHandler(null)
    clearInterval(this.connTimer)
    unregisterCmdHandler(104)
    setReplayGroupHistoryHandler(null)
  },


  methods: {
    /** 处理 socket 收到的消息 */
    handleSocketMessage(msg) {
      console.log("进入 handleSocketMessage:", msg)

      // 私聊消息
      if (msg.type === 'private') {
        const peerId = msg.fromUser === this.userId ? msg.toUser : msg.fromUser

        // 初始化消息数组
        if (!this.privateMessages[peerId]) this.$set(this.privateMessages, peerId, [])

        // 去重
        const exists = this.privateMessages[peerId].some(m => m.msgId === msg.msgId)
        if (!exists) {
          this.privateMessages[peerId].push({...msg, isOffline: false, status: msg.status || 'success'})
        }

        // 当前正在聊天的私聊窗口，滚动到底部
        if (peerId === this.targetId) {
          this.$nextTick(() => {
            this.scrollTop = 100000
          })
        }

        // ⚡ 收集未读 msgId，用于防抖发送已读回执
        if (msg.fromUser !== this.userId) {
          this.collectUnreadMsgIds([msg.msgId], peerId)
        }

        return
      }

      if (msg.type === 'group') {
        const gid = msg.groupId
        if (!this.groupMessages[gid]) this.$set(this.groupMessages, gid, [])

        // 处理补发的消息和普通群消息一致
        const existed = this.groupMessages[gid].some(m => m.msgId === msg.msgId)
        if (!existed) {
          this.groupMessages[gid].push({ ...msg, isOffline: false, type: 'group' })
        }
        // 如果当前就是打开窗口
        if (this.targetType === 'group' && this.targetId === gid) {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1]
            if (last?.msgId) this.debounceSendGroupCursor(gid, last.msgId)
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
        if (!this.privateMessages[this.targetId]) this.$set(this.privateMessages, this.targetId, [])
        this.privateMessages[this.targetId].push(msg)
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
        for (const msgs of Object.values(this.privateMessages)) {
          const msg = msgs.find(m => m.msgId === msgId)
          if (msg && msg.fromUser === this.userId && msg.status === 'success' && msg.type === 'private') {
            msg.status = 'isRead'
            this.msgStatusMap[msgId] = 'isRead'
          }
        }
      })
    },

    /** 收集未读消息 ID，延迟发送已读回执 */
    collectUnreadMsgIds(ids, peerId) {
      if (!peerId) return
      console.log("收集未读ID:", ids, "for peer:", peerId)
      if (!this.unreadMsgIdsBufferMap) this.unreadMsgIdsBufferMap = {}
      if (!this.unreadMsgIdsBufferMap[peerId]) this.unreadMsgIdsBufferMap[peerId] = []
      this.unreadMsgIdsBufferMap[peerId].push(...ids)

      if (this.unreadMsgIdsTimerMap && this.unreadMsgIdsTimerMap[peerId]) {
        clearTimeout(this.unreadMsgIdsTimerMap[peerId])
      } else if (!this.unreadMsgIdsTimerMap) {
        this.unreadMsgIdsTimerMap = {}
      }

      this.unreadMsgIdsTimerMap[peerId] = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBufferMap[peerId]))
        if (uniqueIds.length > 0) sendReadAck(uniqueIds, peerId)
        this.unreadMsgIdsBufferMap[peerId] = []
        this.unreadMsgIdsTimerMap[peerId] = null
      }, 300)
    },

    /** 滚动加载群历史消息 */
    loadMoreMessages() {
      if (this.targetType !== 'group' || !this.groupHasMore || this.loadingHistory) return
      this.loadingHistory = true
      this.groupPageNum += 1
      sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize)
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
      console.log("[mergeGroupHistory] 进入, arr:", arr);
      const gid = this.targetId;
      if (!this.groupMessages[gid] || !Array.isArray(this.groupMessages[gid])) {
        console.log("[mergeGroupHistory] 初始化 groupMessages[gid]");
        this.$set(this.groupMessages, gid, []);
      }

      const existed = new Set(this.groupMessages[gid].map(m => m.msgId));
      console.log("[mergeGroupHistory] 已有消息 ID:", existed);

      arr.forEach(m => {
        if (m && m.msgId && !existed.has(m.msgId)) {
          console.log("[mergeGroupHistory] 插入新消息:", m);

          this.groupMessages[gid].unshift(m); // type 已经在后端和 cmd=103 回调里加了
        }else {
          console.log("[mergeGroupHistory] 跳过重复或非法消息:", m);
        }
      });
      console.log("[mergeGroupHistory] 最终 groupMessages[gid]:", this.groupMessages[gid]);
      this.loadingHistory = false;
    },

    /** 防抖上报群游标 */
    debounceSendGroupCursor:(function () {
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