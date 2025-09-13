<template>
  <!-- 底层背景图 -->
  <image class="bg-image" src="/static/background/index.jpg" mode="aspectFill"/>

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
/* 背景图铺满固定 */
.bg-image {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: -1;        /* 垫在最下面 */
}


/* 2. 容器垂直水平居中 */
.index-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

/* 3. 毛玻璃按钮 */
.index-container button {
  width: 200px;
  height: 44px;
  margin: 12px 0;
  border: none;
  border-radius: 22px;
  font-size: 16px;
  color: pink;                   /* 白色字 */
  background: rgba(0, 0, 0, 0.55);  /* 深灰半透明 */
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,.25);
}
</style>