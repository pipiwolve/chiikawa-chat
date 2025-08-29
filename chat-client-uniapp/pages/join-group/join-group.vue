<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">群聊 ID</text>
        <input v-model="groupId" placeholder="请输入群聊 ID" class="input"/>
      </view>

      <view class="form-item">
        <text class="label">角色（可选）</text>
        <input v-model="role" placeholder="如 member / admin" class="input"/>
      </view>

      <button class="submit-btn" @click="handleJoinGroup">🚪 加入群聊</button>
    </view>

    <view v-if="status" class="status">{{ status }}</view>
  </view>
</template>


<script>
import { joinGroup } from '@/utils/socket.js'

export default {
  data() {
    return {
      groupId: '',
      role: '',
      status: ''
    }
  },
  methods: {
    handleJoinGroup() {
      if (!this.groupId) {
        this.status = '请输入群ID'
        return
      }
      joinGroup(this.groupId, this.role, (resp) => {
        if (resp.result === 'ok') {
          this.status = '成功加入群聊'
        } else {
          this.status = '加入失败: ' + (resp.reason || '未知错误')
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  padding: 30rpx;
  background: #f5f5f5;
  min-height: 100vh;
}
.form {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}
.form-item {
  margin-bottom: 20rpx;
}
.label {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
  display: block;
}
.input {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
}
.submit-btn {
  margin-top: 20rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  padding: 20rpx;
  border-radius: 12rpx;
}
.status {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #666;
}
</style>