<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">好友用户名</text>
        <input v-model="toUserId" placeholder="请输入好友用户名" class="input"/>
      </view>

      <button class="submit-btn" @click="sendFriendRequest">➕ 发送好友请求</button>
    </view>

    <text v-if="status" class="status">{{ status }}</text>

  </view>
</template>


<script>
import { sendFriendRequest, registerCmdHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      toUserId: ''
    }
  },
  onLoad() {
    // 注册 cmd 回调
    registerCmdHandler(202, (data) => {
      if (data.result === "pending") {
        uni.showToast({title: "好友申请已发送", icon: "none"})
      } else if (data.result === "fail") {
        uni.showToast({title: "好友申请失败", icon: "none"})
      }
    })

  },
  methods: {
    sendFriendRequest() {
      if (!this.toUserId.trim()) {
        uni.showToast({title: '请输入好友用户名', icon: 'none'})
        return
      }
      sendFriendRequest(this.toUserId)
    }
  },
  onUnload() {
    registerCmdHandler(202, null)
    registerCmdHandler(207, null)
  }
}
</script>

<style lang="scss" scoped>
/* ================ 视觉变量 ================ */
:root {
  --theme-start: #6366f1;
  --theme-end: #8b5cf6;
  --bg: #f7f8fc;
  --card: #ffffff;
  --radius: 24rpx;
  --shadow: 0 8rpx 30rpx rgba(0, 0, 0, .06);
  --text-title: #1f2937;
  --text-desc: #6b7280;
  --ease: cubic-bezier(.4, .8, .2, 1);
}

/* ================ 页面骨架 ================ */
.page {
  background: var(--bg);
  min-height: 100vh;
  padding: 40rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ================ 卡片表单 ================ */
.form {
  width: 100%;
  max-width: 600rpx;
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 40rpx;
  box-sizing: border-box;
}

.form-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 36rpx;
}

.label {
  font-size: 30rpx;
  color: var(--text-desc);
  margin-bottom: 12rpx;
}

.input {
  height: 88rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  color: var(--text-title);
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  transition: border-color .2s var(--ease);
}
.input:focus {
  border-color: var(--theme-start);
}

/* ================ 渐变按钮 ================ */
.submit-btn {
  width: 100%;
  height: 88rpx;
  border: none;
  border-radius: 12rpx;
  background: linear-gradient(135deg, var(--theme-start), var(--theme-end));
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, .3);
  transition: transform .15s var(--ease);
}
.submit-btn:active {
  transform: scale(.96);
}

/* ================ 状态提示 ================ */
.status {
  margin-top: 40rpx;
  font-size: 28rpx;
  color: var(--text-desc);
}
</style>