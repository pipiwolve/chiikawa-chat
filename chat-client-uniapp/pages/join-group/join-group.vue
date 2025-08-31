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

<style>
.page {
  padding: 30rpx;
}
.form-item {
  margin-bottom: 20rpx;
}
.label {
  font-size: 28rpx;
  margin-right: 10rpx;
}
.input {
  border: 1px solid #ccc;
  padding: 10rpx;
  width: 400rpx;
}
.submit-btn {
  margin-top: 20rpx;
  background: #007aff;
  color: white;
  padding: 20rpx;
  border-radius: 10rpx;
}
.status {
  margin-top: 30rpx;
  color: #666;
}
</style>