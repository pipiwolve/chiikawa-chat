<template>
  <view class="login-container">
    <view class="login-box">
      <text class="title">登录</text>
      <input v-model="userId" placeholder="用户名" class="input"/>
      <input v-model="password" type="password" placeholder="密码" class="input"/>
      <button class="btn" @click="login">登录</button>
      <view class="link">
        <text @click="goRegister">没有账号？注册</text>
      </view>
      <view class="status">{{ status }}</view>
    </view>
  </view>
</template>

<script>
import { connectSocket, sendLogin, setReadAckHandler, setGroupHistoryHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      userId: '',
      password: '',
      status: '',
      socketConnected: false
    }
  },
  methods: {
    login() {
      if (!this.userId.trim() || !this.password.trim()) {
        this.status = '请输入用户名和密码'
        return
      }

      // 建立 WebSocket 连接（如果未连接）
      if (!this.socketConnected) {
        connectSocket(this.userId, (msg) => {
          console.log('[WS] 收到消息:', msg)

          // 后端登录成功返回处理
          if (msg.cmd === 11 && msg.result === 'ok') {
            this.status = '登录成功，跳转中...'

            uni.setStorageSync('currentUserId', this.userId)
            console.log('当前绑定id', this.userId)

            // 跳转到消息中心 (tabbar 页面)
            uni.switchTab({
              url: '/pages/sessions/sessions'
            })
          } else if (msg.cmd === 11 && msg.result === 'fail') {
            this.status = '登录失败，用户名或密码错误'

          }
        })
        this.socketConnected = true
      }

      // 发送登录请求
      sendLogin(this.userId, this.password)

      // 可选：监听已读回执和群历史消息
      setReadAckHandler((msgIds) => {
        console.log('[已读回执]', msgIds)
      })
      setGroupHistoryHandler((history) => {
        console.log('[群历史]', history)
      })

      this.status = '登录请求已发送...'
    },
    goRegister() {
      uni.navigateTo({url: '/pages/register/register'})
    }
  }
}
</script>

<style>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.login-box {
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