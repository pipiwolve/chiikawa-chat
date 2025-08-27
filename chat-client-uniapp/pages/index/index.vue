<template>
  <view class="index-container">
    <button @click="toLogin">登录</button>
    <button @click="toRegister">注册</button>
  </view>
</template>

<script>
export default {
  methods: {
    toLogin() {
      uni.navigateTo({url: '/pages/login/login'});
    },
    toRegister() {
      uni.navigateTo({url: '/pages/register/register'});
    }
  }
}
</script>

<style>
.index-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

button {
  margin: 10px 0;
  width: 200px;
  height: 40px;
}
</style>