<template>
  <view class="chat-container">
    <view class="chat-right">

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
            :class="['msg-item', item.fromUser === userId ? 'self' : 'friend']"
            @click="msgClick(item)"
        >
          <!-- 接收方头像（左侧）-->
          <image
              v-if="item.fromUser !== userId"
              :src="item.avatar || friendAvatar"
              class="avatar"
              mode="widthFix"
          />

          <view v-if="item.fromUser === userId && item.type === 'private'" class="msg-status">
            <text v-if="item.status === 'sending'">…</text>
            <text v-else-if="item.status === 'failed'">!</text>
            <text v-else-if="item.status === 'success'">✔</text>
            <text v-else-if="item.status === 'isRead'">✔✔</text>
          </view>

          <!-- 消息内容 -->
          <view class="msg-content" v-if="item.messageType === 'text'">
            {{ item.content }}
            <view class="msg-timestamp">{{ formatTimestamp(item.timestamp) }}</view>
          </view>

          <view class="msg-content" v-else-if="item.messageType==='image'">
            <image :src="item.content" mode="widthFix" class="msg-image" @click="previewImage(item.content)" />
          </view>

          <view class="msg-content" v-else-if="item.messageType==='voice'">
            <button class="msg-voice-btn">
              {{ item.content || '播放语音' }}
            </button>
          </view>

          <!-- 发送方头像（右侧）-->
          <image
              v-if="item.fromUser === userId"
              :src="item.avatar || selfAvatar"
              class="avatar"
              mode="widthFix"
          />


        </view>
        <view v-if="loadingHistory" class="loading-tip">加载中...</view>
      </scroll-view>

    </view>

      <!-- 固定底部输入栏 -->
      <view class="chat-input-bar">
        <block v-if="messageType === 'text'">
          <image src="/static/icons/voice.png" mode="widthFix" class="left-icon" @click="messageType='voice'" />
          <input type="text" v-model="inputMsg" class="msg-input" @confirm="sendMsg" />
          <image src="/static/icons/album.png" mode="widthFix" class="thumb" @click="chooseImage" />
        </block>

        <block v-else-if="messageType === 'voice'">
          <image src="/static/icons/text.png" class="left-icon" @click="messageType='text'" />
          <text class="voice-crl" @touchstart="touchstart" @touchend="touchend">
            {{ recordStart ? '松开 发送' : '按住 说话' }}
          </text>
        </block>
      </view>

      <!-- 语音录制动画 & 表情面板保持原有 -->
      <view v-if="recordStart" class="audio-animation">
        <view class="audio-wave">
          <text class="audio-wave-text" v-for="item in 10" :style="{'animation-delay': `${item/10}s`}"></text>
          <view class="text">松开 发送</view>
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

const recorderManager = wx.getRecorderManager()

export default {
  data() {
    return {
      privateMessages: {},   // { targetId: [msg1, msg2, ...] }
      groupMessages: {},     // { groupId: [msg1, msg2, ...] }
      messageType: 'text',
      recordStart: false,
      inputMsg: '',
      msgStatusMap:{},
      userId: '',
      targetId: '',
      targetType: '',
      currentTargetName: '',
      selfAvatar: uni.getStorageSync('currentUserAvatar') || '', // 登录时存的头像 key
      friendAvatar: '', // 会在 onLoad 里根据 target 赋值
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
    this.selfAvatar = uni.getStorageSync('currentUserAvatar') || this.selfAvatar || '/static/default-avatar/wusaqi.png'
    this.targetId = options.targetId
    this.targetType = options.type
    this.currentTargetName = options.name || ''
    this.friendAvatar = options.avatar || this.friendAvatar || '/static/default-avatar/xiaoqi.png'


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
                status: 'success',
                messageType:m.messageType||'text'
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


  onHide() {
    if (this._innerAudioContext) {
      this._innerAudioContext.stop()
    }
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
          this.privateMessages[peerId].push({...msg, isOffline: false, status: msg.status || 'success', messageType: msg.messageType || 'text'})
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
          this.groupMessages[gid].push({ ...msg, isOffline: false, type: 'group', messageType: msg.messageType || 'text'})
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
        status: 'sending',
        messageType: 'text' // text / image / voice
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

    chooseImage() {
      uni.chooseImage({
        // sourceType: 'album',
        success: (res) => {
          this.list.push({
            content: res.tempFilePaths[0],
            userType: 'self',
            messageType: 'image',
            avatar: this._selfAvatar
          })
          this.scrollToBottom()
          // 模拟对方回复
          setTimeout(() => {
            this.list.push({
              content: '风景好漂亮啊~',
              userType: 'friend',
              avatar: this._friendAvatar
            })
            this.scrollToBottom()
          }, 1500)
        }
      })
    },

    scrollToBottom() {
      this.top = this.list.length * 1000
    },

    msgClick(data) {
      if (data.messageType === 'voice') {
        if (this._innerAudioContext) {
          this._innerAudioContext.stop()
          this._innerAudioContext.src = data.audioSrc
          this._innerAudioContext.play()
          return
        }
        this.play(data.audioSrc)
      }
    },

    authTips() {
      uni.showModal({
        title: '提示',
        content: '您拒绝了麦克风权限，将导致功能不能正常使用，去设置权限？',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            uni.openSetting({
              success: (res) => {
                if (res.authSetting['scope.record']) {
                  console.log("已授权麦克风");
                  this._recordAuth = true
                } else {
                  // 未授权
                  wx.showModal({
                    title: '提示',
                    content: '您未授权麦克风，功能将无法使用',
                    showCancel: false,
                    confirmText: '知道了'
                  })
                }
              }
            })
          }
        }
      })
    },

    touchstart() {
      //开始录音
      const _permission = 'scope.record'
      uni.getSetting({
        success: (res) => {
          // 判断是否有相关权限属性
          if (res.authSetting.hasOwnProperty(_permission)) {
            // 属性存在，且为false，用户拒绝过权限
            if (!res.authSetting[_permission]) {
              this.authTips()
            } else {
              // 已授权
              this._recordAuth = true
              // 开始录音
              recorderManager.start()
              recorderManager.onStart(() => {
                this.recordStart = true
              })

              // 错误回调
              recorderManager.onError((res) => {
                console.log('recorder error', res)
                uni.showToast({
                  icon: 'none',
                  title: '系统出错，请重试'
                })
                this.recordStart = false
              })
            }
          } else {
            // 属性不存在，需要授权
            uni.authorize({
              scope: _permission,
              success: () => {
                // 授权成功
                this._recordAuth = true
              },
              fail: (res) => {
                /**
                 * 104 未授权隐私协议
                 * 用户可能拒绝官方隐私授权弹窗，为了避免过度弹窗打扰用户，开发者再次调用隐私相关接口时，
                 * 若距上次用户拒绝不足10秒，将不再触发弹窗，直接给到开发者用户拒绝隐私授权弹窗的报错
                 */
                if (res.error == 104) {
                  uni.showModal({
                    title: '温馨提示',
                    content: '您拒绝了隐私协议，请稍后再试',
                    confirmText: '知道了',
                    showCancel: false,
                    success: () => {}
                  })
                } else {
                  // 用户拒绝授权
                  this.authTips()
                }
              }
            })
          }
        }
      })
    },

    touchend() {
      if (!this._recordAuth || !this.recordStart) return
      //停止录音
      recorderManager.stop();
      recorderManager.onStop((res) => {
        console.log('结束录音', res)
        const { duration, tempFilePath } = res
        this.recordStart = false

        // 确保目标数组已初始化
        const peerId = this.targetId;
        if (!this.privateMessages[peerId]) this.$set(this.privateMessages, peerId, []);

        // 生成统一消息对象
        const msg = {
          msgId: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          fromUser: this.userId,
          toUser: peerId,
          content: `语音 ${Math.round(duration / 1000)}''`,
          audioSrc: tempFilePath,
          timestamp: Date.now(),
          type: 'private',
          messageType: 'voice',
          status: 'sending',  // 默认 sending
          isOffline: false
        }

        // push 到消息数组
        this.privateMessages[peerId].push(msg)

        // 调用发送函数（把语音文件上传或发到 socket）
        sendMsg(msg, (status) => {
          msg.status = status
        })

        // 滚动到底部
        this.$nextTick(() => {
          this.scrollTop = 100000
        })
      })
    },

    //播放声音
    play(src) {
      this._innerAudioContext = wx.createInnerAudioContext()
      this._innerAudioContext.src = src
      this._innerAudioContext.play()
      this._innerAudioContext.onPlay(() => {
        console.log('开始播放')
      })
      this._innerAudioContext.onEnded(() => {
        // 播放完毕，清除音频链接
        console.log('播放完毕');
      })
      this._innerAudioContext.onError((res) => {
        console.log('audio play error', res)
      })
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
      const toInsert = Array.from(arr)
        .reverse()
        .filter(m => m && m.msgId && !existed.has(m.msgId))
        .map(m => ({
          ...m,
          messageType: m.messageType || 'text',
          status: m.status || 'success'
        }));
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
          // Normalize message object as in mergePrivateHistory
          this.groupMessages[gid].unshift({
            ...m,
            type: 'group',
            messageType: m.messageType || 'text',
            status: m.status || 'success',
            isOffline: m.isOffline || false
          });
        } else {
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

<style lang="scss" scoped>

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $uni-bg-color-grey;
}

/* 注意：不要把 overflow: hidden 写在这里，会把 fixed 元素裁掉 */
.chat-right {
  flex: 1;
  display: flex;
  flex-direction: column;
}


/* 消息列表：给底部留出输入栏高度（含安全区） */
.msg-list {
  flex: 1;
  padding: 20rpx;
  overflow-y: auto;
  background-color: $uni-bg-color;
  box-sizing: border-box;
  padding-bottom: 160rpx;
}

/* 单条消息 */
.msg-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20rpx;
  /* 默认左右排列由 template 的头像顺序控制 */
  position: relative;
}

/* 头像 */
.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 10rpx;
  object-fit: cover;
}

/* 气泡 */
.msg-content {
  max-width: 60vw;
  padding: 16rpx 20rpx;
  border-radius: $uni-border-radius-lg;
  font-size: 28rpx;
  line-height: 1.4;
  word-wrap: break-word;
  position: relative;
}

/* 时间 */
.msg-timestamp {
  font-size: $uni-font-size-sm;
  color: #FFFFFF;
  margin-top: 6rpx;
}

/* 接收方（左）*/
.msg-item.friend {
  justify-content: flex-start;

  .avatar {
    margin-right: 20rpx;
  }

  .msg-content {
    background: $uni-bg-color-grey;
    color: $uni-text-color;
  }

  .msg-content::after {
    content: '';
    position: absolute;
    border: 12rpx solid transparent;
    border-right: 12rpx solid $uni-bg-color-grey;
    left: -12rpx;
    top: 18rpx;
  }
}

/* 发送方（右）*/
.msg-item.self {
  justify-content: flex-end;
  display: flex;
  align-items: flex-end;

  .avatar {
    margin-left: 20rpx;
  }

  .msg-status {
    font-size: $uni-font-size-sm;
    color: $uni-text-color-grey;
    margin-right: 8rpx; // ✅ 与气泡之间留间距
    align-self: flex-end; // ✅ 保证和气泡底部对齐
  }

  .msg-content {
    background: $uni-color-primary;
    color: $uni-text-color-inverse;
  }

  .msg-content::after {
    content: '';
    position: absolute;
    border: 12rpx solid transparent;
    border-left: 12rpx solid $uni-color-primary;
    right: -12rpx;
    top: 18rpx;
  }
}

/* 底部固定输入栏 */
.chat-input-bar {
  position: fixed; /* 固定在底部 */
  bottom: 0;
  left: 0;
  width: 100%;
  min-height: 120rpx; /* 最小高度 */
  display: flex;
  align-items: center;
  background: #FFFFFF;
  padding: 20rpx 24rpx 20rpx 40rpx;
  box-sizing: border-box;
  z-index: 999; /* 保证在 scroll-view 之上 */

  /* iOS 安全区适配 */
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));

  /* 左侧图标 */
  .left-icon {
    width: 56rpx;
    height: 56rpx;
    margin-right: 10rpx;
  }

  /* 输入框 & 语音控件 */
  .msg-input,
  .voice-crl {
    flex: 1;
    height: 70rpx;
    background: #eee;
    border-radius: 10rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    margin-right: 30rpx;
    box-sizing: border-box;
  }

  /* 右侧按钮 */
  .thumb {
    width: 64rpx;
    height: 64rpx;
  }

  /* 语音控件文本样式 */
  .voice-crl {
    text-align: center;
    line-height: 70rpx;
    font-weight: bold;
  }
}


/* 输入框样式 */
.msg-input {
  flex: 1;
  border: 1px solid $uni-border-color;
  border-radius: $uni-border-radius-lg;
  padding: 10rpx 20rpx;
  font-size: 28rpx;
  background: $uni-bg-color-grey;
}


.msg-voice-btn {
  border: none;
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
  padding: 6px 12px;
  border-radius: $uni-border-radius-base;
}

.msg-image {
  width: 150rpx;
  height: auto;
  border-radius: $uni-border-radius-lg;
}

.audio-animation {
  position: fixed;
  // width: 100vw;
  // height: 100vh;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 202410;
  display: flex;
  justify-content: center;
  align-items: center;

  .text {
    text-align: center;
    font-size: 28rpx;
    color: #333;
    margin-top: 60rpx;
  }

  .audio-wave {
    padding: 50rpx;

    .audio-wave-text {
      background-color: blue;
      width: 7rpx;
      height: 12rpx;
      margin: 0 6rpx;
      border-radius: 5rpx;
      display: inline-block;
      border: none;
      animation: wave 0.25s ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }

    /*  声波动画  */
    @keyframes wave {
      from {
        transform: scaleY(1);
      }

      to {
        transform: scaleY(4);
      }
    }
  }
}
</style>