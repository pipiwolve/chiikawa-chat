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
  setReplayGroupHistoryHandler,
  setPrivateHistoryHandler,
  sendPrivateHistoryRequest


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
      unreadMsgIdsTimer: null,
      privatePageNum: 1,
      privatePageSize: 50,
      privateHasMore: true,
      loadingPrivateHistory: false
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



    // 注册回调
    setGroupHistoryHandler(arr => {
      this.loadingHistory = false;
      if (!Array.isArray(arr) || arr.length === 0) {
        this.groupHasMore = false;
        return;
      }
      this.mergeGroupHistory(arr);
      this.$nextTick(() => {
        this.scrollTop = 100000;
        // ⬇️ 历史消息加载完成后，立刻上报最新游标
        const last = this.groupMessages[this.targetId][this.groupMessages[this.targetId].length - 1];
        if (last?.msgId) this.debounceSendGroupCursor(this.targetId, last.msgId);
      });
    });


    setReplayGroupHistoryHandler(arr => {
      if (!Array.isArray(arr) || arr.length === 0) return;
      this.mergeGroupHistory(arr); // merge 到 groupMessages
      this.$nextTick(() => { this.scrollTop = 100000 });
    });

    // 注册私聊历史回调
    setPrivateHistoryHandler((arr) => {
      this.loadingPrivateHistory = false;
      if (!Array.isArray(arr) || arr.length === 0) {
        // 如果是第一页返回空，说明没有更多历史
        if (this.privatePageNum === 1) this.privateHasMore = false;
        return;
      }
      // 将历史合并到 privateMessages[this.targetId]
      this.mergePrivateHistory(arr);

      // 收到历史后：如果有来自对方的未读消息，收集并防抖发送已读 ack
      const peerId = this.targetId;
      const unreadIds = arr.filter(m => m.fromUser === peerId && !m.isRead).map(m => m.msgId);
      if (unreadIds.length > 0) this.collectUnreadMsgIds(unreadIds, peerId);

      this.$nextTick(() => { this.scrollTop = 100000 });
    });

    // 注册已读回执 & 群历史回调
    setReadAckHandler(msgIds => this.handleReadAck(Array.isArray(msgIds) ? msgIds : [msgIds]))


    // 建立 socket
    connectSocket(this.userId, msg => console.log('[WS] 收到消息:', msg))
    onPrivateMessage(msg => this.handleSocketMessage(msg))
    onGroupMessage(msg => this.handleSocketMessage(msg))

    // 拉取私聊离线消息
    if (this.targetType === 'private') {
      this.privatePageNum = 1;
      this.privateHasMore = true;
      this.loadingPrivateHistory = true;
      sendPrivateHistoryRequest(this.targetId, this.privatePageNum, this.privatePageSize);

      // 确保离线释放消息在历史就消息后
      setTimeout(() => {
        fetchOfflinePrivateMessages(this.targetId, (offlineMsgs) => {
          if (Array.isArray(offlineMsgs) && offlineMsgs.length > 0) {
            // 1. 确保已有数组（历史消息）
            if (!this.privateMessages[this.targetId]) {
              this.$set(this.privateMessages, this.targetId, []);
            }

            // 2. 先按时间排序（旧 → 新）
            offlineMsgs.sort((a, b) => a.timestamp - b.timestamp);

            // 3. 逐条 append（push）到已有数组（保证离线消息在底部）
            offlineMsgs.forEach(m => {
              this.privateMessages[this.targetId].push({
                ...m,
                isOffline: true,
                status: 'success'
              });
            });

            // 4. 收集未读（只针对对方发来的）
            const unreadIds = offlineMsgs
                .filter(m => m.fromUser === this.targetId)
                .map(m => m.msgId);

            if (unreadIds.length > 0) this.collectUnreadMsgIds(unreadIds, this.targetId);

            this.$nextTick(() => {
              this.scrollTop = 100000;
            });
          }
        })
      }, 200)

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
    if (this.targetType === 'group') {
      const msgs = this.groupMessages[this.targetId] || [];
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (last?.msgId) sendGroupCursor(this.targetId, last.msgId); // ⬅️ 主动更新游标
      }
    }

    uni.$emit("clearUnread", {
      sessionId: this.targetId,
      type: this.targetType
    });



    unregisterCmdHandler(2, this.handleSocketMessage)
    unregisterCmdHandler(3, this.handleSocketMessage)
    unregisterCmdHandler(103)
    unregisterCmdHandler(105)
    setGroupHistoryHandler(null)
    setPrivateHistoryHandler && setPrivateHistoryHandler(null)
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

        return
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

      // ✅ 主动刷新消息中心会话列表
      uni.$emit("refreshSessions")
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

    // 滚动加载私聊（在 scroll 至顶触发）
    loadMoreMessages() {
      // 如果是群聊逻辑已有实现，扩展支持私聊
      if (this.targetType === 'group') {
        if (!this.groupHasMore || this.loadingHistory) return;
        this.loadingHistory = true;
        this.groupPageNum += 1;
        sendGroupHistoryRequest(this.targetId, this.groupPageNum, this.groupPageSize);
        return;
      }

      if (this.targetType === 'private') {
        if (!this.privateHasMore || this.loadingPrivateHistory) return;
        this.loadingPrivateHistory = true;
        this.privatePageNum += 1;
        sendPrivateHistoryRequest(this.targetId, this.privatePageNum, this.privatePageSize);
        return;
      }
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

    /** 合并私聊历史（把更早的消息放在数组前面） */
    mergePrivateHistory(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        this.loadingPrivateHistory = false;
        return;
      }
      const peerId = this.targetId;
      if (!this.privateMessages[peerId] || !Array.isArray(this.privateMessages[peerId])) {
        this.$set(this.privateMessages, peerId, []);
      }

      // 当前数组中已有 id 集合（用于去重）
      const existed = new Set(this.privateMessages[peerId].map(m => m.msgId));

      // 假设服务端按 create_time DESC 返回（最新在前）：
      // 为把历史“插到顶部（旧消息在前）”我们先 reverse，再concat
      const toInsert = Array.from(arr).reverse().filter(m => m && m.msgId && !existed.has(m.msgId));
      this.privateMessages[peerId] = toInsert.concat(this.privateMessages[peerId]);

      // 如果返回条数 < pageSize 则说明没有更多
      if (arr.length < this.privatePageSize) {
        this.privateHasMore = false;
      }
      this.loadingPrivateHistory = false;

      // 合并完成后，统一设置 status（便于前端回显）
      const msgs = this.privateMessages[peerId];
      if (Array.isArray(msgs)) {
        msgs.forEach(m => {
          // 仅为自己发送的消息显示已读/未读
          if (m.fromUser === this.userId) {
            m.status = (m.isRead ? 'isRead' : (m.status || 'success'));
          } else {
            m.status = m.status || 'success';
          }
        });
      }

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