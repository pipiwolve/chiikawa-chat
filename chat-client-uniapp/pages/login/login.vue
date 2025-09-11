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

      // 调用 REST 登录
      uni.request({
        url: 'http://localhost:8080/api/auth/login',
        method: 'POST',
        data: {
          userId: this.userId,
          password: this.password
        },
        success: (res) => {
          if (res.data.result === 'ok') {
            const token = res.data.token
            uni.setStorageSync('token', token)
            uni.setStorageSync('currentUserId', this.userId)
            // ✅ 使用 token 建立 WebSocket 连接（只调用一次）
            connectSocket(this.userId, token, (msg) => {

              if (msg.result === 'ok') {
                this.status = '登录成功，跳转中...'
                uni.switchTab({ url: '/pages/sessions/sessions' })
              } else if (msg.result === 'fail') {
                this.status = '登录失败，用户名或密码错误'
              }
            })

          } else {
            this.status = res.data.message || '登录失败'
          }
        }

      })


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