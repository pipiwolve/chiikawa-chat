<template>

  <image class="bg-image" src="/static/background/login.jpg" mode="aspectFill"/>
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
            const username = res.data.username
            const avatar = res.data.avatar
            uni.setStorageSync('token', token)
            uni.setStorageSync('currentUserId', this.userId)
            uni.setStorageSync('currentUserName', username || '')
            uni.setStorageSync('currentUserAvatar', avatar || '/static/default-avatar/wusaqi.png')
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

/* 1. 全屏背景图（小程序安全写法） */
.bg-image {
position: fixed;
left: 0;
top: 0;
width: 100%;
height: 100%;
z-index: -1;
}

/* 2. 登录容器垂直水平居中 */
.login-container {
display: flex;
justify-content: center;
align-items: center;
min-height: 100vh;
padding: 20px;
}

/* 3. 毛玻璃卡片 */
.login-box {
width: 90%;
max-width: 360px;
padding: 40px 30px;
border-radius: 24px;
background: rgba(255, 255, 255, 0.20);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.25);
box-shadow: 0 12px 40px rgba(0, 0, 0, 0.20);
}

/* 4. 标题 */
.title {
font-size: 32px;
font-weight: 600;
color: cadetblue;
text-align: center;
margin-bottom: 30px;
letter-spacing: 2px;
}

/* 5. 全透明输入框（只留底线） */
.input {
  width: 100%;
  height: 48px;
  padding: 0 8px;
  margin-bottom: 20px;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);   /* 底线 */
  border-radius: 0;                                      /* 去掉圆角 */
  font-size: 16px;
  color: black;                                           /* 字白色 */
  background: transparent;                               /* 完全透明 */
  box-shadow: none;
  caret-color: black;                                     /* 光标白色 */
}

/* 输入框聚焦时底线加粗变色 */
.input:focus {
  border-bottom: 2px solid #667eea;
  outline: none;
}

/* 占位符颜色淡一点 */
.input::placeholder {
  color: rgba(255, 255, 255, 0.65);
}

/* 6. 登录按钮（渐隐 + 按压效果） */
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

/* 7. 底部文字 */
.link {
text-align: center;
margin-top: 20px;
font-size: 14px;
color: rgba(10, 9, 9, 0.57);
}

.link text {
border-bottom: 1px solid rgba(10, 9, 9, 0.57);
}

/* 8. 状态提示 */
.status {
margin-top: 15px;
font-size: 13px;
text-align: center;
color: rgba(10, 9, 9, 0.57);
}

</style>