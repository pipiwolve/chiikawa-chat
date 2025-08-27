<template>
  <view class="register-container">
    <view class="register-box">
      <text class="title">注册</text>
      <input v-model="userId" placeholder="用户名" class="input"/>
      <input v-model="password" type="password" placeholder="密码" class="input"/>
      <input v-model="nickname" placeholder="昵称" class="input"/>
      <button class="btn" @click="register">注册</button>
      <view class="link">
        <text @click="goLogin">已有账号？登录</text>
      </view>
      <view class="status">{{ status }}</view>
    </view>
  </view>
</template>

<script>
import { connectSocket, sendRegister, setReadAckHandler, setGroupHistoryHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      userId: '',
      password: '',
      nickname: '',
      status: '',
      socketConnected: false
    }
  },
  methods: {
    register() {
      if (!this.userId.trim() || !this.password.trim() || !this.nickname.trim()) {
        this.status = '请输入完整信息'
        return
      }

      // 建立 WebSocket 连接（如果未连接）
      if (!this.socketConnected) {
        connectSocket(this.userId, (msg) => {
          console.log('[WS] 收到消息:', msg)

          // 后端注册成功返回处理
          if (msg.cmd === 10 && msg.result === 'ok') {
            this.status = '注册成功，跳转登录...'
            uni.redirectTo({url: '/pages/login/login'})
          } else if (msg.cmd === 10 && msg.result === 'fail') {
            this.status = '注册失败，用户名可能已存在'
          }
        })
        this.socketConnected = true
      }

      // 发送注册请求
      sendRegister(this.userId, this.password, this.nickname)

      // 可选：监听已读回执和群历史消息
      setReadAckHandler((msgIds) => {
        console.log('[已读回执]', msgIds)
      })
      setGroupHistoryHandler((history) => {
        console.log('[群历史]', history)
      })

      this.status = '注册请求已发送...'
    },
    goLogin() {
      uni.navigateTo({url: '/pages/login/login'})
    }
  }
}
</script>

<style>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.register-box {
  width: 90%;
  max-width: 350px;
  padding: 20px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.input {
  width: 100%;
  margin-bottom: 15px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.btn {
  width: 100%;
  padding: 10px;
  background: #1AAD19;
  color: #fff;
  border: none;
  border-radius: 5px;
}

.title {
  font-size: 24px;
  margin-bottom: 20px;
  display: block;
  text-align: center;
}

.link {
  text-align: center;
  margin-top: 10px;
  color: #1AAD19;
}

.status {
  margin-top: 10px;
  color: #f00;
  text-align: center;
}
</style>