<template>
  <view class="chat-container">
    <!-- 联系人列表 -->
    <ContactList
        :users="contacts"
        :selectedUserId="targetId"
        @select="handleSelectUser"
    />

    <!-- 群组列表 -->
    <GroupList
        :groups="groups"
        :selectedGroupId="targetId"
        @select="handleSelectUser"
    />

    <!-- 消息列表 -->
    <scroll-view scroll-y class="msg-list" :scroll-top="scrollTop" @scrolltolower="loadMoreMessages">
      <view v-for="(item, index) in messages" :key="item.msgId || index"
            :class="[
              'msg-item',
              item.fromUser === userId ? 'msg-sent' : 'msg-received',
              item.isOffline ? 'offline-msg' : '',
              item.status === 'sending' ? 'msg-sending' : '',
              item.status === 'failed' ? 'msg-failed' : '',
              item.status === 'isRead' && item.fromUser === userId ? 'msg-isRead' : ''
            ]">
        <view class="msg-nickname">{{ item.nickname || item.fromUser }}</view>
        <view class="msg-content">{{ item.content }}</view>
        <view class="msg-timestamp">{{ formatTimestamp(item.timestamp) }}</view>

        <!-- 发送方消息状态显示 -->
        <view v-if="item.fromUser === userId" class="msg-status">
          <text v-if="item.status === 'sending'">发送中...</text>
          <text v-else-if="item.status === 'failed'">
            发送失败
            <button @click="retrySend(item)">重试</button>
          </text>
          <text v-else-if="item.status === 'success'">未读</text>
          <text v-else-if="item.status === 'isRead'">已读</text>
        </view>
      </view>
    </scroll-view>

    <!-- 输入区 -->
    <view class="input-box">
      <input v-model="inputMsg" placeholder="输入消息..." class="msg-input" />
      <button @click="sendMsg">发送</button>
    </view>

    <view>
      <button @click="disconnect">断开连接</button>
    </view>

    <!-- 连接状态显示 -->
    <view class="status">连接状态: {{ connectionStatus }}</view>
  </view>
</template>

<script>
import {connectSocket, sendMsg, sendGroupMsg, isConnected, closeSocket, setReadAckHandler, sendReadAck} from '@/utils/socket.js'
import ContactList from '@/components/ContactList.vue'
import GroupList from '@/components/GroupList.vue'

export default {
  components: { ContactList, GroupList },
  data() {
    return {
      messages: [],
      inputMsg: '',
      userId: '',
      targetId: '',
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
      unreadMsgIdsTimer: null,
    }
  },
  onLoad(options) {
    this.userId = options.userId || 'user1'
    this.targetId = this.contacts.concat(this.groups).find(c => c.id !== this.userId)?.id || ''
    this.connectionStatus = '连接中...'

    setReadAckHandler((msgIds) => {
      const list = Array.isArray(msgIds) ? msgIds : [msgIds];
      this.handleReadAck(list);
    });

    connectSocket(this.userId, (msg) => {
      if (Array.isArray(msg)) {
        const offlineMsgs = msg.map(m => ({ ...m, isOffline: true, status: null }));
        this.messages.push(...offlineMsgs);

        const unreadOfflineMsgs = offlineMsgs.filter(m => m.fromUser !== this.userId && m.fromUser === this.targetId);
        const unreadMsgIds = unreadOfflineMsgs.map(m => m.msgId).filter(id => !!id);
        if (unreadMsgIds.length > 0) this.collectUnreadMsgIds(unreadMsgIds);

        this.$nextTick(() => { this.scrollTop = 100000; });
      } else {
        const existingIdx = this.messages.findIndex(m => m.msgId === msg.msgId);
        if (existingIdx !== -1) {
          this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg };
        } else {
          this.messages.push({ ...msg, isOffline: false, status: null });
        }

        if (msg.msgId && msg.fromUser !== this.userId && msg.fromUser === this.targetId) {
          this.collectUnreadMsgIds([msg.msgId]);
        }

        this.$nextTick(() => { this.scrollTop = 100000; });
      }
    });

    setInterval(() => {
      const status = isConnected() ? '已连接' : '未连接'
      this.connectionStatus = status;
    }, 1000)
  },
  onUnload() {
    setReadAckHandler(null);
    if (this.unreadMsgIdsTimer) {
      clearTimeout(this.unreadMsgIdsTimer);
      this.unreadMsgIdsTimer = null;
    }
  },
  methods: {
    sendMsg() {
      if (!this.inputMsg) return
      const target = this.contacts.concat(this.groups).find(c => c.id === this.targetId)
      if (!target) {
        uni.showToast({title: '请选择联系人或群组', icon: 'none'})
        return
      }

      const msgId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 10000)

      const newMsg = {
        msgId,
        fromUser: this.userId,
        toUser: this.targetId,
        content: this.inputMsg,
        status: 'sending',
        isOffline: false,
        timestamp: Date.now(),
        type: target.type,
        nickname: (this.contacts.find(c => c.id === this.userId) || {}).name || this.userId
      };
      this.messages.push(newMsg);

      const onStatusChange = (status) => {
        this.msgStatusMap[msgId] = status;
        newMsg.status = status;
      };

      if (target.type === 'user') {
        sendMsg(this.targetId, this.inputMsg, this.userId, onStatusChange, msgId);
      } else if (target.type === 'group') {
        sendGroupMsg(this.targetId, this.inputMsg, this.userId, onStatusChange, msgId);
      }

      this.inputMsg = ''
      this.$nextTick(() => { this.scrollTop = 100000; });
    },

    handleSelectUser(id) {
      const pendingIds = this.messages
          .filter(m => m.fromUser !== this.userId && m.toUser === this.targetId)
          .map(m => m.msgId)
          .filter(Boolean);
      if (pendingIds.length) sendReadAck(pendingIds);

      this.targetId = id;
      this.messages = [];
    },

    loadMoreMessages() { console.log('滚动到底部，加载更多消息'); },

    handleReadAck(msgIds) {
      msgIds.forEach(msgId => {
        const msg = this.messages.find(m => m.msgId === msgId);
        if (msg && msg.fromUser === this.userId && msg.status === 'success') {
          msg.status = 'isRead';
          this.msgStatusMap[msgId] = 'isRead';
        }
      });
    },

    collectUnreadMsgIds(ids) {
      this.unreadMsgIdsBuffer.push(...ids);
      if (this.unreadMsgIdsTimer) clearTimeout(this.unreadMsgIdsTimer);
      this.unreadMsgIdsTimer = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBuffer));
        if (uniqueIds.length > 0) sendReadAck(uniqueIds);
        this.unreadMsgIdsBuffer = [];
        this.unreadMsgIdsTimer = null;
      }, 300);
    },

    disconnect() { closeSocket(); },
    formatTimestamp(ts) {
      if (!ts) return '';
      const date = new Date(ts);
      return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    },

    retrySend(msg) {
      if (!msg.msgId) return;
      msg.status = 'sending';
      this.msgStatusMap[msg.msgId] = 'sending';
      const onStatusChange = (status) => {
        this.msgStatusMap[msg.msgId] = status;
        msg.status = status;
      };
      if (msg.type === 'user') {
        sendMsg(msg.toUser, msg.content, msg.fromUser, onStatusChange);
      } else if (msg.type === 'group') {
        sendGroupMsg(msg.toUser, msg.content, msg.fromUser, onStatusChange);
      }
    }
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