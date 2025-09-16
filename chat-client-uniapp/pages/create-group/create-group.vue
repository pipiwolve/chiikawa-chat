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

<script setup>
import { ref } from 'vue'
import { useStore } from 'vuex'
import { onShow } from '@dcloudio/uni-app'
import { createGroup } from '@/utils/socket.js'

/* 响应式数据 */
const store = useStore()
const groupName = ref('')
const membersText = ref('')
const status = ref('')

/* 方法：创建群聊 */
function handleCreateGroup() {
  if (!groupName.value.trim()) {
    status.value = '请输入群聊名称'
    return
  }
  const members = membersText.value
      .split(',')
      .map(m => m.trim())
      .filter(m => m)

  status.value = '正在创建...'
  createGroup(groupName.value, members, (resp) => {
    if (resp.result === 'ok') {
      status.value = `群聊创建成功：${resp.groupName} (ID: ${resp.groupId})`
      // 后端会推 203 → App.vue 已统一 mergeGroup，这里不再 emit
    } else {
      status.value = '创建失败: ' + (resp.reason || '未知错误')
    }
  })
}


/* 兜底：进入页面时拉一次最新列表（可选）*/
onShow(() => {
  store.dispatch('groups/loadGroups')   // 只兜底，不监听
})
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

/* 单行输入框 */
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

/* 多行文本域 */
.textarea {
  height: 160rpx;
  padding: 24rpx;
  font-size: 32rpx;
  color: var(--text-title);
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  resize: none;               /* 禁止拖动，防止样式穿帮 */
  transition: border-color .2s var(--ease);
}
.textarea:focus {
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