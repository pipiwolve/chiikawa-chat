<template>
  <view class="chat-container">
    <ContactList 
      :users="contacts" 
      :selectedUserId="targetId" 
      @select="handleSelectUser" 
    />

    <scroll-view scroll-y class="msg-list">
      <view v-for="(item, index) in messages" :key="index" class="msg-item">
        <text>{{ item.from }}: {{ item.text }}</text>
      </view>
    </scroll-view>

    <view class="input-box">
      <input v-model="inputMsg" placeholder="输入消息..." class="msg-input"/>
      <button @click="sendMsg">发送</button>
    </view>
  </view>
</template>

<script>
import { connectSocket, sendMsg } from '@/utils/socket.js'
import ContactList from '@/components/ContactList.vue'

export default {
  components: { ContactList },
  data() {
    return {
      messages: [],
      inputMsg: '',
      userId: '',
      targetId: '',
      contacts: [
        { id: 'user1', name: '用户一' },
        { id: 'user2', name: '用户二' },
        { id: 'user3', name: '用户三' }
      ]
    }
  },
  onLoad(options) {
    this.userId = options.userId || 'user1';
    // 默认私聊对象为自己以外的第一个联系人
    this.targetId = this.contacts.find(c => c.id !== this.userId)?.id || '';
    connectSocket(this.userId, (msg) => {
      this.messages.push(msg)
    })
  },
  methods: {
    sendMsg() {
      if (!this.inputMsg) return;
      sendMsg(this.targetId, this.inputMsg, this.userId)
      this.messages.push({ from: this.userId, text: this.inputMsg })
      this.inputMsg = ''
    },
    handleSelectUser(userId) {
      this.targetId = userId
      // 你可以选择清空消息或加载聊天记录
      // this.messages = []
    }
  }
}
</script>

<style>
.chat-container { display: flex; flex-direction: column; height: 100%; }
.msg-list { flex: 1; padding: 10px; }
.msg-item { margin: 5px 0; }
.input-box { display: flex; padding: 10px; }
.msg-input { flex: 1; border: 1px solid #ccc; padding: 5px; }
</style>