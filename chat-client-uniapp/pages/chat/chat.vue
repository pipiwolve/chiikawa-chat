<template>
  <view class="chat-container">
    <!-- 联系人/群组列表 -->
    <ContactList :users="contacts" :selectedUserId="targetId" @select="handleSelectUser" />
    <GroupList :groups="groups" :selectedGroupId="targetId" @select="handleSelectGroup" />

    <!-- 消息区右侧 -->
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
  sendGroupHistoryRequest
} from '@/utils/socket.js'
import ContactList from '@/components/ContactList.vue'
import GroupList from '@/components/GroupList.vue'

export default {
  components: {ContactList, GroupList},
  data() {
    return {
      messages: [],
      groupMessages: {},
      unreadGroupCount: {},
      inputMsg: '',
      userId: '',
      targetId: '',
      targetType: '',
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

      groupPageNum: 1,
      groupPageSize: 20,
      groupHasMore: true,
      loadingHistory: false
    }
  },
  computed: {
    currentMessages() {
      return this.targetType === 'private'
          ? this.messages
          : (this.groupMessages[this.targetId] || [])
    },
    currentTargetName() {
      const contact = this.contacts.find(c => c.id === this.targetId);
      if (contact) return contact.name;
      const group = this.groups.find(g => g.id === this.targetId);
      return group ? group.name : '';
    }
  },
  onLoad(options) {
    this.userId = options.userId || '';
    this.connectionStatus = '连接中...';

    setReadAckHandler(msgIds => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]));
    setGroupHistoryHandler(arr => {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
    });

    connectSocket(this.userId, msg => this.handleSocketMessage(msg));

    setInterval(() => {
      this.connectionStatus = isConnected() ? '已连接' : '未连接';
    }, 1000);
  },
  methods: {
    handleSocketMessage(msg) {
      if (msg.cmd === 10) { // 注册回执
        this.statusMsg = msg.result === 'ok' ? '注册成功，请登录' : '注册失败';
        return;
      }
      if (msg.cmd === 11) { // 登录回执
        if (msg.result === 'ok') {
          this.userId = msg.fromUser || this.userId;
          this.statusMsg = '登录成功';

          const firstContact = this.contacts.find(c => c.id !== this.userId);
          this.targetId = firstContact ? firstContact.id : '';
          this.targetType = this.contacts.find(c => c.id === this.targetId) ? 'private' : 'group';

          if (this.targetType === 'group' && !this.groupMessages[this.targetId]) {
            this.$set(this.groupMessages, this.targetId, []);
          }

          if (this.targetType === 'group') {
            sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
          }

          this.initOfflineMessages();
        } else {
          this.statusMsg = '登录失败';
        }
        return;
      }
      this.processMessage(msg);
    },
    initOfflineMessages() {
      sendReadAck([]); // 初始化未读
    },
    processMessage(msg) {
      if (Array.isArray(msg)) {
        const offlineMsgs = msg.map(m => ({...m, isOffline: true, status: null}));
        this.messages.push(...offlineMsgs);
        const unreadIds = offlineMsgs.filter(m => m.fromUser !== this.userId).map(m => m.msgId).filter(Boolean);
        if (unreadIds.length > 0) this.collectUnreadMsgIds(unreadIds);
        this.$nextTick(() => {
          this.scrollTop = 100000;
        });
        return;
      }
      if (msg.cmd === 3) { // 群聊
        const gid = msg.groupId;
        if (!gid) return;
        if (!this.groupMessages[gid]) this.$set(this.groupMessages, gid, []);
        const exists = this.groupMessages[gid].some(m => m.msgId === msg.msgId);
        if (!exists) this.groupMessages[gid].push({...msg, isOffline: false});
        if (this.targetType !== 'group' || this.targetId !== gid) {
          this.$set(this.unreadGroupCount, gid, (this.unreadGroupCount[gid] || 0) + 1);
        } else {
          this.$nextTick(() => {
            const last = this.groupMessages[gid][this.groupMessages[gid].length - 1];
            this.debounceSendGroupCursor(gid, last?.msgId);
            this.scrollTop = 100000;
          });
        }
        return;
      }
      const existingIdx = this.messages.findIndex(m => m.msgId === msg.msgId);
      if (existingIdx !== -1) {
        this.messages[existingIdx] = {...this.messages[existingIdx], ...msg};
      } else {
        this.messages.push({...msg, isOffline: false, status: null});
      }
      if (msg.msgId && msg.fromUser !== this.userId && msg.type === 'private' && msg.fromUser === this.targetId) {
        this.collectUnreadMsgIds([msg.msgId]);
      }
      this.$nextTick(() => {
        this.scrollTop = 100000;
      });
    },
    sendMsg() {
      if (!this.inputMsg.trim()) return;
      const msg = {
        msgId: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        fromUser: this.userId,
        content: this.inputMsg,
        timestamp: Date.now(),
        type: this.targetType,
        status: 'sending'
      };
      const onStatusChange = status => {
        msg.status = status;
        this.msgStatusMap[msg.msgId] = status
      };
      if (this.targetType === 'private') {
        msg.toUser = this.targetId;
        sendMsg(msg, onStatusChange);
        this.messages.push(msg);
      } else {
        msg.groupId = this.targetId;
        sendGroupMsg(msg, onStatusChange);
        if (!this.groupMessages[this.targetId]) this.$set(this.groupMessages, this.targetId, []);
        this.groupMessages[this.targetId].push(msg);
      }
      this.inputMsg = '';
      this.$nextTick(() => {
        this.scrollTop = 100000
      });
    },
    handleSelectUser(id) {
      this.targetId = id;
      this.targetType = 'private';
    },
    handleSelectGroup(gid) {
      this.targetId = gid;
      this.targetType = 'group';
      this.unreadGroupCount[gid] = 0;
    },
    handleReadAck(msgIds) {
      msgIds.forEach(msgId => {
        const msg = this.messages.find(m => m.msgId === msgId);
        if (msg && msg.fromUser === this.userId && msg.status === 'success' && msg.type === 'private') {
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

    // 滚动加载历史消息
    loadMoreMessages() {
      if (this.targetType !== 'group' || !this.groupHasMore) return;
      const groupId = this.targetId;
      const pageNum = this.groupPageNum + 1;
      sendGroupHistoryRequest(groupId, pageNum, this.groupPageSize);
      this.groupPageNum = pageNum;
    },


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
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      arr.forEach(m => {
        if (!this.groupMessages[m.groupId]) this.$set(this.groupMessages, m.groupId, []);
        this.groupMessages[m.groupId].unshift(m); // 插入到顶部
      });
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