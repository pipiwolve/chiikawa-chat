<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">群聊 ID</text>
        <input v-model="groupId" placeholder="请输入群聊 ID" class="input"/>
      </view>

      <button class="submit-btn" @click="handleJoinGroup">🚪 申请加入群聊</button>
    </view>

    <view v-if="status" class="status">{{ status }}</view>
  </view>
</template>

<script>
import { sendJoinGroupRequest } from '@/utils/socket.js'

export default {
  data() {
    return {
      groupId: '',
      status: '',
      userId: ''
    }
  },

  onLoad() {
    this.userId = uni.getStorageSync("currentUserId") || ''
  },

  methods: {
    handleJoinGroup() {
      if (!this.groupId) {
        this.status = '请输入群ID'
        return
      }


      sendJoinGroupRequest(this.groupId, this.userId)
          .then((res) => {
            if (res.result === 'pending') {
              this.status = '申请已发送，请等待群主处理';
              uni.showToast({ title: "申请已发送", icon: "success" });
              setTimeout(() => uni.navigateBack(), 800);
            } else {
              this.status = '发送失败: ' + (res.reason || '未知错误');
            }
          })
          .catch((err) => {
            console.error("[join-group] 发送申请失败:", err);
            this.status = '发送失败，请重试';
          });
    }
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
  max-width: 600rpx;          /* 宽屏也居中好看 */
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
  box-shadow: 0 4rpx 16rpx rgba(99, 102, 241, .3);
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