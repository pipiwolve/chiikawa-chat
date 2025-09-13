<template>
  <image class="bg-image" src="/static/background/login.jpg" mode="aspectFill"/>
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

      // 发送注册请求
      uni.request({
        url: 'http://localhost:8080/api/auth/register',
        method: 'POST',
        data: {
          userId: this.userId,
          password: this.password,
          nickname: this.nickname
        },
        success: (res) => {
          if (res.data.result === 'ok'){
            this.status = '注册成功，跳转登录...'
            uni.redirectTo({url: '/pages/login/login'})
          } else {
            this.status = '注册失败，用户名可能已存在'
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

      this.status = '注册请求已发送...'
    },
    goLogin() {
      uni.navigateTo({url: '/pages/login/login'})
    }
  }
}
</script>

<style>
/* ========== 通用背景 ========== */
.bg-image {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

/* ========== 容器居中 ========== */
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

/* ========== 毛玻璃卡片 ========== */
.register-box {
  width: 90%;
  max-width: 360px;
  padding: 40px 30px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.20);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.20);
}

/* ========== 标题 ========== */
.title {
  font-size: 32px;
  font-weight: 600;
  color: cadetblue;
  text-align: center;
  margin-bottom: 30px;
  letter-spacing: 2px;
}

/* ========== 全透明输入框（只有底线） ========== */
.input {
  width: 100%;
  height: 48px;
  padding: 0 8px;
  margin-bottom: 20px;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 0;
  font-size: 16px;
  color: black;
  background: transparent;
  box-shadow: none;
  caret-color: black;
  position: relative;
  z-index: 10;
}
.input:focus {
  border-bottom: 2px solid #667eea;
  outline: none;
}
.input::placeholder {
  color: rgba(255, 255, 255, 0.65);
}

/* ========== 注册按钮（渐隐） ========== */
.btn {
  width: 100%;
  height: 48px;
  margin-top: 10px;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 15px rgba(118, 75, 162, 0.4);
  transition: opacity 0.2s;
}
.btn:active {
  opacity: 0.85;
}

/* ========== 底部文字 ========== */
.link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: rgba(10, 9, 9, 0.57);
}
.link text {
  border-bottom: 1px solid rgba(10, 9, 9, 0.57);
}

/* ========== 状态提示 ========== */
.status {
  margin-top: 15px;
  font-size: 13px;
  text-align: center;
  color: rgba(10, 9, 9, 0.57);
}
</style>