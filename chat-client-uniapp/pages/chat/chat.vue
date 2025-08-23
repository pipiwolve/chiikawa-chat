<template>
  <view class="chat-container">
    <!-- 联系人/群组列表 -->
    <ContactList
        :users="contacts"
        :selectedUserId="targetId"
        @select="handleSelectUser"
    />
    <GroupList
        :groups="groups"
        :selectedGroupId="targetId"
        @select="handleSelectGroup"
    />

    <!-- 消息显示区 -->
    <scroll-view
        scroll-y
        class="msg-list"
        :scroll-top="scrollTop"
        @scrolltolower="loadMoreMessages"
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

        <!-- 私聊才显示已读/未读状态 -->
        <view v-if="item.fromUser === userId && item.type === 'private'" class="msg-status">
          <text v-if="item.status === 'sending'">发送中...</text>
          <text v-else-if="item.status === 'failed'">
            <button @click="retrySend(item)">重试</button>
          </text>
          <text v-else-if="item.status === 'success'">未读</text>
          <text v-else-if="item.status === 'isRead'">已读</text>
        </view>
      </view>
    </scroll-view>

    <!-- 输入框 -->
    <view class="input-box">
      <input v-model="inputMsg" placeholder="输入消息..." class="msg-input" />
      <button @click="sendMsg">发送</button>
    </view>

    <!-- 调试用 -->
    <view>
      <button @click="disconnect">断开连接</button>
    </view>
    <view class="status">连接状态: {{ connectionStatus }}</view>
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
  setGroupHistoryHandler
} from '@/utils/socket.js'
import ContactList from '@/components/ContactList.vue'
import GroupList from '@/components/GroupList.vue'

export default {
  components: { ContactList, GroupList },
  data() {
    return {
      messages: [],                 // 私聊消息
      groupMessages: {},            // 群聊消息 {gid: [msg]}
      unreadGroupCount: {},         // 群未读数
      inputMsg: '',
      userId: '',
      targetId: '',
      targetType:'',
      contacts: [
        {id: 'user1', name: '用户一', type: 'user'},
        {id: 'user2', name: '用户二', type: 'user'}
      ],
      groups: [
        {id: 'group1', name: '群聊1', type: 'group'},
        {id: 'group2', name: '群聊2', type: 'group'}
      ],
      connectionStatus: '未连接',
      scrollTop: 0,
      msgStatusMap: {},
      unreadMsgIdsBuffer: [],
      unreadMsgIdsTimer: null
    }
  },
  computed: {
    currentMessages() {
      console.log('[Debug] currentMessages computed -> targetType:', this.targetType, 'targetId:', this.targetId);
      return this.targetType === 'private'
          ? this.messages
          : (this.groupMessages[this.targetId] || [])
    }
  },
  onLoad(options) {
    this.userId = options.userId || 'user1';
    this.targetId = this.contacts.concat(this.groups).find(c => c.id !== this.userId)?.id || '';
    this.targetType = this.contacts.find(c => c.id === this.targetId) ? 'private' : 'group';

    console.log('[Debug] onLoad -> targetId:', this.targetId, 'targetType:', this.targetType);
    this.connectionStatus = '连接中...'

    // 注册已读 ACK 回调
    setReadAckHandler((msgIds) => {
      const list = Array.isArray(msgIds) ? msgIds : [msgIds]
      this.handleReadAck(list)
    })

    // 注册群聊历史回调
    setGroupHistoryHandler((arr) => this.mergeGroupHistory(arr))

    // 连接 WebSocket
    connectSocket(this.userId, (msg) => {
      if (Array.isArray(msg)) {
        // 离线私聊消息数组
        const offlineMsgs = msg.map(m => ({ ...m, isOffline: true, status: null }))
        this.messages.push(...offlineMsgs)

        const unreadOfflineMsgs = offlineMsgs.filter(m =>
            m.fromUser !== this.userId
        )

        const unreadMsgIds = unreadOfflineMsgs.map(m => m.msgId).filter(Boolean)
        if (unreadMsgIds.length > 0) this.collectUnreadMsgIds(unreadMsgIds)
        this.$nextTick(() => { this.scrollTop = 100000 })
      } else if (msg.cmd === 3) {
        // 群聊消息
        const gid = msg.groupId
        if (!gid) return
        if (!this.groupMessages[gid]) this.$set(this.groupMessages, gid, [])

        const exists = this.groupMessages[gid].some(m => m.msgId === msg.msgId)
        if (!exists) {
          this.groupMessages[gid].push({ ...msg, isOffline: false })
        }

        if (this.targetType !== 'group' || this.targetId !== gid) {
          this.$set(this.unreadGroupCount, gid, (this.unreadGroupCount[gid] || 0) + 1)
        } else {
            this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1]
            this.debounceSendGroupCursor(gid, last?.msgId)
            this.scrollTop = 100000
          })
        }
      } else {
        // 单条实时私聊消息
        const existingIdx = this.messages.findIndex(m => m.msgId === msg.msgId)
        if (existingIdx !== -1) {
          this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg }
        } else {
          this.messages.push({ ...msg, isOffline: false, status: null })
        }

        if (
            msg.msgId &&
            msg.fromUser !== this.userId &&
            msg.type === 'private' &&
            msg.fromUser === this.targetId
        ) {
          this.collectUnreadMsgIds([msg.msgId])
        }

        this.$nextTick(() => { this.scrollTop = 100000 })
      }
    })

    // 定时刷新连接状态
    setInterval(() => {
      this.connectionStatus = isConnected() ? '已连接' : '未连接'
    }, 1000)
  },
  methods: {
    // 发送消息
    sendMsg() {
      if (!this.inputMsg.trim()) return
      const msg = {
        msgId: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        fromUser: this.userId,
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
        msg.toUser = this.targetId
        sendMsg(msg, onStatusChange)
        this.messages.push(msg)
      } else {
        msg.groupId = this.targetId
        sendGroupMsg(msg, onStatusChange)
        if (!this.groupMessages[this.targetId]) this.$set(this.groupMessages, this.targetId, [])
        this.groupMessages[this.targetId].push(msg)
      }
      this.inputMsg = ''
      this.$nextTick(() => { this.scrollTop = 100000 })
    },
    // 选择联系人
    handleSelectUser(id) {
      this.targetId = id
      this.targetType = 'private'
      console.log('[Debug] handleSelectUser -> targetId:', this.targetId, 'targetType:', this.targetType);
    },
    // 选择群组
    handleSelectGroup(gid) {
      this.targetId = gid
      this.targetType = 'group'
      this.unreadGroupCount[gid] = 0
      console.log('[Debug] handleSelectGroup -> targetId:', this.targetId, 'targetType:', this.targetType);

    },
    // 已读 ACK 回调
    handleReadAck(msgIds) {
      msgIds.forEach(msgId => {
        const msg = this.messages.find(m => m.msgId === msgId)
        if (msg && msg.fromUser === this.userId && msg.status === 'success' && msg.type === 'private') {
          msg.status = 'isRead'
          this.msgStatusMap[msgId] = 'isRead'
        }
      })
    },
    // 收集私聊已读消息ID
    collectUnreadMsgIds(ids) {
      this.unreadMsgIdsBuffer.push(...ids)
      if (this.unreadMsgIdsTimer) clearTimeout(this.unreadMsgIdsTimer)
      this.unreadMsgIdsTimer = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBuffer))
        if (uniqueIds.length > 0) sendReadAck(uniqueIds)
        this.unreadMsgIdsBuffer = []
        this.unreadMsgIdsTimer = null
      }, 300)
    },
    loadMoreMessages() { /* 分页留空 */ },
    disconnect() { closeSocket() },
    formatTimestamp(ts) {
      const d = new Date(ts)
      return d.toLocaleTimeString()
    },
    retrySend(msg) {
      msg.status = 'sending'
      if (msg.type === 'private') {
        sendMsg(msg)
      } else {
        sendGroupMsg(msg)
      }
    },
    // 合并群聊历史
    mergeGroupHistory(arr) {
      if (!Array.isArray(arr)) return
      arr.forEach(m => {
        if (!this.groupMessages[m.groupId]) this.$set(this.groupMessages, m.groupId, [])
        this.groupMessages[m.groupId].push(m)
      })
    },
    // 防抖上报群游标
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
  }
}
</script>

<style>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.msg-list {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
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

/* 自己发的消息右对齐，背景颜色不同 */
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

/* 已读显示 */
.msg-isRead {
  color: #4caf50;
  font-weight: 500;
  opacity: 1;
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

.msg-status text {
  margin-left: 6px;
}
.msg-status text:nth-child(3) {
  color: #999; /* 未读灰色 */
  font-weight: 500;
}
.msg-status text:nth-child(4) {
  color: #4caf50; /* 已读绿色 */
}

/* 离线消息样式 */
.offline-msg {
  border-left: 4px solid #ff9800;
  background-color: #fff8e1;
}

/* 发送中消息样式，半透明 */
.msg-sending {
  opacity: 0.7;
}

/* 发送失败消息样式，红色字体 */
.msg-failed {
  color: red;
}

.msg-nickname {
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 4px;
  color: #555;
}

.msg-content {
  font-size: 14px;
  color: #333;
}

.msg-timestamp {
  font-size: 10px;
  color: #999;
  align-self: flex-end;
  margin-top: 4px;
  margin-bottom: 2px;
}

.input-box {
  display: flex;
  padding: 10px;
}

.msg-input {
  flex: 1;
  border: 1px solid #ccc;
  padding: 5px;
}

.status {
  padding: 5px 10px;
  font-size: 12px;
  color: #888;
}

.msg-status button {
  margin-left: 6px;
  font-size: 12px;
  color: #f56c6c;
  background: transparent;
  border: none;
  cursor: pointer;
}
</style>