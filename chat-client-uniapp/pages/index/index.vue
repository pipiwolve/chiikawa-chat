<template>
  <view class="container">
    <text>请选择登录用户：</text>
    <button @click="goChat('user1')">用户一</button>
    <button @click="goChat('user2')">用户二</button>
  </view>
</template>

<script>
export default {
  methods: {
    goChat(userId) {
      uni.navigateTo({
        url: `/pages/chat/chat?userId=${userId}`
      });
    }
  }
}
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  padding: 20px;
}
button {
  margin: 10px 0;
  padding: 12px;
  background-color: #007AFF;
  color: white;
  border-radius: 6px;
}
</style>