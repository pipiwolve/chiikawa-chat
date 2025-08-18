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
              item.from === userId ? 'msg-sent' : 'msg-received',
              item.isOffline ? 'offline-msg' : '',
              item.status === 'sending' ? 'msg-sending' : '',
              item.status === 'failed' ? 'msg-failed' : '',
              item.status === 'read' && item.from === userId ? 'msg-read' : ''
            ]">
        <view class="msg-nickname">{{ item.nickname || item.from }}</view>
        <view class="msg-content">{{ item.message }}</view>
        <view class="msg-timestamp">{{ formatTimestamp(item.timestamp) }}</view>

        <!-- 发送方消息状态显示 -->
        <view v-if="item.from === userId" class="msg-status">
          <text v-if="item.status === 'sending'">发送中...</text>
          <text v-else-if="item.status === 'failed'">
            发送失败
            <button @click="retrySend(item)">重试</button>
          </text>
          <text v-else-if="item.status === 'success'">未读</text>
          <text v-else-if="item.status === 'read'">已读</text>
        </view>
        <!-- 接收方不显示消息状态 -->
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
      msgStatusMap: {}, // 存放消息发送状态，key为msgId，value为'sending'|'success'|'failed'|'read'
      unreadMsgIdsBuffer: [], // 用于收集未读消息ID，防抖批量发送已读回执
      unreadMsgIdsTimer: null,
    }
  },
  onLoad(options) {
    // 路由参数提取
    this.userId = options.userId || 'user1'
    console.log('[页面加载] 当前用户ID:', this.userId)
    // 默认选中联系人或群组中非自己的第一个
    this.targetId = this.contacts.concat(this.groups).find(c => c.id !== this.userId)?.id || ''
    this.connectionStatus = '连接中...'

    // 注册全局已读回调：socket.js 收到 cmd=101 时只调用该回调，不再把消息抛给页面
    setReadAckHandler((msgIds) => {
      console.log('[chat.vue] setReadAckHandler 回调触发，msgIds:', msgIds);
      const list = Array.isArray(msgIds) ? msgIds : [msgIds];
      this.handleReadAck(list);
    });

    connectSocket(this.userId, (msg) => {
      console.log('[WebSocket] 收到消息:', msg);

      if (Array.isArray(msg)) {
        //--批量离线消息，追加到 messages 列表，并标记 isOffline
        const offlineMsgs = msg.map(m => {
          return { ...m, isOffline: true, status: null };
        });
        this.messages.push(...offlineMsgs);

        // 收集当前会话对方未读消息 msgId，防抖批量调用 sendReadAck
        // 只保留别人发给自己的信息，同时只保留当前正在聊天的对象发来的信息
        const unreadOfflineMsgs = offlineMsgs.filter(m => m.from !== this.userId && m.from === this.targetId);
        const unreadMsgIds = unreadOfflineMsgs.map(m => m.msgId).filter(id => !!id);
        if (unreadMsgIds.length > 0) {
          this.collectUnreadMsgIds(unreadMsgIds);
        }

        this.$nextTick(() => {
          this.scrollTop = 100000; // 滚动到最新消息
        });
      } else {
        //--单条实时消息
        // 之
        const existingIdx = this.messages.findIndex(m => m.msgId === msg.msgId);
        if (existingIdx !== -1) {
          console.log(this.messages[existingIdx]);
          this.messages[existingIdx] = { ...this.messages[existingIdx], ...msg };
        } else {
          // 新消息初始状态：接收方不显示状态
          this.messages.push({ ...msg, isOffline: false, status: null });
        }

        // 收集当前会话对方未读消息 msgId，防抖批量调用 sendReadAck
        if (msg.msgId && msg.from !== this.userId && msg.from === this.targetId) {
          this.collectUnreadMsgIds([msg.msgId]);
        }

        this.$nextTick(() => {
          this.scrollTop = 100000; // 滚动到最新消息
        });
      }
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
  onUnload() {
    // 页面卸载时取消注册，避免重复回调/内存泄漏
    setReadAckHandler(null);
    if (this.unreadMsgIdsTimer) {
      clearTimeout(this.unreadMsgIdsTimer);
      this.unreadMsgIdsTimer = null;
    }
  },
  methods: {
    // 发送消息方法，支持发送状态回调更新
    sendMsg() {
      if (!this.inputMsg) return

      // 根据选中目标是用户还是群组，调用不同接口
      const target = this.contacts.concat(this.groups).find(c => c.id === this.targetId)
      if (!target) {
        uni.showToast({title: '请选择联系人或群组', icon: 'none'})
        return
      }
      console.log('[发送] 目标:', this.targetId, '消息:', this.inputMsg)

      // 生成唯一消息ID，避免渲染重复和状态匹配问题
      const msgId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 10000)

      // 创建消息对象，添加到消息列表，状态初始为sending
      const newMsg = {
        msgId : msgId,
        from: this.userId,
        to: this.targetId,
        message: this.inputMsg,
        status: 'sending',
        isOffline: false,
        timestamp: Date.now(),
        type: target.type,
        nickname: (this.contacts.find(c => c.id === this.userId) || {}).name || this.userId
      };
      this.messages.push(newMsg);
      console.log('debug', newMsg);

      // 发送消息，传入状态更新回调，动态更新消息发送状态
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

      this.$nextTick(() => {
        this.scrollTop = 100000
      })
    },

    // 选择聊天对象，切换聊天目标
    handleSelectUser(id) {
      // 发送当前会话未读消息的已读回执
      const pendingIds = this.messages
          .filter(m => m.from !== this.userId && m.to === this.targetId)
          .map(m => m.msgId)
          .filter(Boolean);
      if (pendingIds.length) {
        sendReadAck(pendingIds);
      }
      this.targetId = id;
      console.log('[切换聊天对象] 目标ID:', id);
      // 切换聊天对象时清空消息（可改为加载历史以提升用户体验）
      this.messages = [];
    },

    // 滚动到底部，加载更多消息（占位）
    loadMoreMessages() {
      // TODO: 实现消息分页加载
      console.log('滚动到底部，加载更多消息')
    },

    // 处理已读信息操作，仅更新发送方消息状态
    handleReadAck(msgIds) {
      // 调试：查看当前消息列表的 msgId
      console.log('[handleReadAck] 当前消息列表 msgIds:', this.messages.map(m => m.msgId));

      // 调试：查看收到的回执 msgIds
      console.log('[handleReadAck] 收到回执 msgIds:', msgIds);
      msgIds.forEach(msgId => {
        const msg = this.messages.find(m => m.msgId === msgId);
        if (msg) {
          // 仅更新发送方状态：已发送未读(success) => 已读(read)
          if (msg.from === this.userId && msg.status === 'success') {
            msg.status = 'read';
            this.msgStatusMap[msgId] = 'read';
            console.log('[chat.vue] 更新消息状态为已读:', msg);
          }
        } else {
          console.warn('[chat.vue] 找不到 msgId 对应的消息:', msgId);
        }
      });
    },

    // 收集未读消息ID，防抖批量调用 sendReadAck
    collectUnreadMsgIds(ids) {
      this.unreadMsgIdsBuffer.push(...ids);
      if (this.unreadMsgIdsTimer) {
        clearTimeout(this.unreadMsgIdsTimer);
      }
      this.unreadMsgIdsTimer = setTimeout(() => {
        const uniqueIds = Array.from(new Set(this.unreadMsgIdsBuffer));
        if (uniqueIds.length > 0) {
          sendReadAck(uniqueIds);
        }
        this.unreadMsgIdsBuffer = [];
        this.unreadMsgIdsTimer = null;
      }, 300);
    },

    // 关闭连接操作
    disconnect() {
      closeSocket()
      console.log('手动断开 WebSocket 连接')
    },

    // 格式化时间戳为 HH:mm 格式
    formatTimestamp(ts) {
      if (!ts) return '';
      const date = new Date(ts);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    },

    // 重试发送失败的消息，更新状态
    retrySend(msg) {
      if (!msg.msgId) {
        uni.showToast({title: '无法重发：缺少msgId', icon: 'none'});
        return;
      }
      // 设置状态为发送中
      msg.status = 'sending';
      this.msgStatusMap[msg.msgId] = 'sending';

      // 重新发送消息，传入回调更新状态
      const onStatusChange = (status) => {
        this.msgStatusMap[msg.msgId] = status;
        msg.status = status;
      };

      if (msg.type === 'user') {
        sendMsg(msg.to, msg.message, msg.from, onStatusChange);
      } else if (msg.type === 'group') {
        sendGroupMsg(msg.to, msg.message, msg.from, onStatusChange);
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
.msg-read {
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