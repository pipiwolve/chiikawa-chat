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
      <view v-for="(item, index) in messages" :key="index"
            :class="['msg-item', item.from === userId ? 'msg-sent' : 'msg-received']">
        <view class="msg-nickname">{{ item.nickname || item.from }}</view>
        <view class="msg-content">{{ item.message }}</view>
        <view class="msg-timestamp">{{ formatTimestamp(item.timestamp) }}</view>

        <!-- 发送状态显示 -->
        <view v-if="item.from === userId" class="msg-status">
          <text v-if="item.status === 'sending'">发送中...</text>
          <text v-if="item.status === 'failed'">
            发送失败
            <button @click="retrySend(index)">重试</button>
          </text>
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
import { connectSocket, sendMsg, sendGroupMsg, isConnected, closeSocket } from '@/utils/socket.js'
import ContactList from '@/components/ContactList.vue'
import GroupList from '@/components/GroupList.vue'

export default {
  components: {
    ContactList,
    GroupList
  },
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
      scrollTop: 0, // 用于消息滚动控制
    }
  },
  onLoad(options) {
    this.userId = options.userId || 'user1'
    console.log('[页面加载] 当前用户ID:', this.userId)
    // 默认选中联系人或群组中非自己的第一个
    this.targetId = this.contacts.concat(this.groups).find(c => c.id !== this.userId)?.id || ''
    this.connectionStatus = '连接中...'

    connectSocket(this.userId, (msg) => {
      console.log('[WebSocket] 收到消息:', msg)
      // 这里的 msg 可能是一条消息，也可能是服务端批量发送的消息数组
      if (Array.isArray(msg)) {
        // 批量离线消息，追加到 messages 列表
        this.messages.push(...msg);
      } else {
        // 单条实时消息
        this.messages.push(msg);
      }

      // 滚动到底部，显示最新消息
      this.$nextTick(() => {
        this.scrollTop = 100000;
      });
    });

    // 监听连接状态变化（简单模拟，实际可扩展socket.js发事件）
    setInterval(() => {
      const status = isConnected() ? '已连接' : '未连接'
      if (this.connectionStatus !== status) {
        console.log('[连接状态] 状态变化:', status)
      }
      this.connectionStatus = status;
    }, 1000)
  },
  methods: {
    sendMsg() {
      if (!this.inputMsg) return

      // 根据选中目标是用户还是群组，调用不同接口
      const target = this.contacts.concat(this.groups).find(c => c.id === this.targetId)
      if (!target) {
        uni.showToast({title: '请选择联系人或群组', icon: 'none'})
        return
      }
      console.log('[发送] 目标:', this.targetId, '消息:', this.inputMsg)

      if (target.type === 'user') {
        sendMsg(this.targetId, this.inputMsg, this.userId)
      } else if (target.type === 'group') {
        sendGroupMsg(this.targetId, this.inputMsg, this.userId)
      }

      // 本地先添加消息（发送者自己） - 使用统一的 ChatMessage 格式
      this.messages.push({
        cmd: target.type === 'user' ? 2 : 3,
        type: target.type,
        from: this.userId,
        to: this.targetId,
        message: this.inputMsg,
        timestamp: new Date().getTime()
      })

      console.log('[发送] 本地消息列表长度:', this.messages.length)

      this.inputMsg = ''

      this.$nextTick(() => {
        this.scrollTop = 100000
      })
    },

    handleSelectUser(id) {
      this.targetId = id
      console.log('[切换聊天对象] 目标ID:', id)
      // 切换聊天对象时清空消息（可改为加载历史）
      this.messages = []
    },

    loadMoreMessages() {
      // TODO: 实现消息分页加载
      console.log('滚动到底部，加载更多消息')
    },

    // 关闭连接操作
    disconnect() {
      closeSocket()
      console.log('手动断开 WebSocket 连接')
    },

    formatTimestamp(ts) {
      if (!ts) return '';
      const date = new Date(ts);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
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

.msg-status {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
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