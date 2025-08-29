<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">群聊名称</text>
        <input v-model="groupName" placeholder="请输入群聊名称" class="input"/>
      </view>

      <view class="form-item">
        <text class="label">群成员</text>
        <textarea v-model="membersText" placeholder="输入成员ID，逗号分隔" class="textarea"/>
      </view>

      <button class="submit-btn" @click="handleCreateGroup">➕ 创建群聊</button>
    </view>

    <view v-if="status" class="status">{{ status }}</view>
  </view>
</template>

<script>
import { createGroup } from '@/utils/socket.js'

export default {
  data() {
    return {
      groupName: '',
      membersText: '',
      status: ''
    }
  },
  methods: {
    handleCreateGroup() {
      if (!this.groupName) {
        this.status = '请输入群聊名称'
        return
      }
      const members = this.membersText.split(',').map(m => m.trim()).filter(m => m)
      createGroup(this.groupName, members, (resp) => {
        if (resp.result === 'ok') {
          this.status = `群聊创建成功：${resp.groupName} (ID: ${resp.groupId})`
        } else {
          this.status = '创建失败: ' + (resp.reason || '未知错误')
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
.textarea {
  width: 100%;
  height: 160rpx;
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