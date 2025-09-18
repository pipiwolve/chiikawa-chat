<template>
  <view class="page">
    <view class="avatar-section" @click="chooseAvatar">
      <image :src="avatar || defaultAvatar" class="avatar" mode="aspectFill" />
      <text class="change-tip">点击更换头像</text>
    </view>
    <view class="form">
      <view class="form-item">
        <text class="label">群聊名称</text>
        <input v-model="groupName" placeholder="请输入群聊名称" class="input"/>
      </view>

      <view class="form-item">
        <text class="label">群成员</text>
        <textarea v-model="membersText" placeholder="输入成员ID，逗号分隔" class="textarea"/>
      </view>

      <button class="submit-btn" @click="handleCreateGroup">创建群聊</button>
    </view>

    <view v-if="status" class="status">{{ status }}</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useStore } from 'vuex'
import { onShow } from '@dcloudio/uni-app'
import { createGroup } from '@/utils/socket.js'
import {registerCmdHandler} from "../../utils/socket.js";

/* 响应式数据 */
const store = useStore()
const groupName = ref('')
const membersText = ref('')
const status = ref('')
const avatar = ref('')   // 用户选择的本地头像路径（预览用）
const defaultAvatar = '/static/default-avatar/xiaoqi.png'
const avatarUploadPath = ref('') // 用于上传

// 上传接口地址
const UPLOAD_URL = "http://localhost:8080/api/upload"

/* 选择头像：只做本地选择和预览，不上传 */
function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    success: (res) => {
      const localPath = res.tempFilePaths[0]  // 本地路径，仅预览用
      avatar.value = localPath
      avatarUploadPath.value = localPath
      console.log('[chooseAvatar] avatar.value=', localPath)
    },
    fail: (err) => console.error('[chooseAvatar] fail', err)
  })
}
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
  console.log('[handleCreateGroup] start', groupName.value, members)
  createGroup(groupName.value, members,
      registerCmdHandler(203, (data) => {
        console.log('[createGroup callback] resp=', data)
    if (data.result === 'ok') {
      console.log('[createGroup] ok groupId=', data.groupId)
      console.log('[createGroup] current avatar.value=', avatar.value)
      status.value = `群聊创建成功：${data.groupName} (ID: ${data.groupId})`
      // 如果选择了头像，创建成功后再上传
      if (avatarUploadPath.value) {
        uploadGroupAvatar(data.groupId, avatarUploadPath.value)
      }

    } else {
      console.warn('[createGroup] failed', data)
      status.value = '创建失败: ' + (data.reason || '未知错误')
    }
  }))
  }


/* 上传群头像 */
function uploadGroupAvatar(groupId, localPath) {
  const token = uni.getStorageSync("token") || ""
  uni.uploadFile({
    url: UPLOAD_URL,
    filePath: localPath,
    name: "file",
    header: {Authorization: token ? `Bearer ${token}` : ""},
    success: (uploadRes) => {
      try {
        const data = JSON.parse(uploadRes.data)
        if (data && data.result === "ok" && data.url) {
          updateGroupAvatar(groupId, data.url)
        } else {
          uni.showToast({icon: "none", title: "上传失败"})
        }
      } catch (e) {
        console.error("upload parse error", e)
      }
    },
    fail: (err) => {
      console.error("uploadFile fail", err)
      uni.showToast({icon: "none", title: "上传失败"})
    }
  })
}

/* 更新群资料里的头像 */
function updateGroupAvatar(groupId, newUrl) {
  uni.request({
    url: "http://172.21.67.11:8080/api/user/updateGroupAvatar",
    method: "POST",
    header: {
      Authorization: `Bearer ${uni.getStorageSync("token")}`
    },
    data: {groupId, avatar: newUrl},
    success: (res) => {
      if (res.data.result === "ok") {
        uni.showToast({icon: "success", title: "头像已更新"})
        store.dispatch('groups/loadGroups', true)
      } else {
        uni.showToast({icon: "none", title: res.data.message || "更新失败"})
      }
    },
    fail: (err) => {
      console.error("update avatar fail", err)
    }
  })
}

/* 兜底：进入页面时拉一次最新列表（可选）*/
onShow(() => {
store.dispatch('groups/loadGroups')   // 只兜底，不监听
})
</script>

<style lang="scss" scoped>
.avatar-section {
  position: relative;
  margin-bottom: 60rpx;
}

.avatar {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: #f2f2f2;

  /* 黑边突出 */
  border: 6rpx solid #000; /* 粗细可自己调 */
  box-sizing: border-box; /* 保证尺寸不变 */
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, .15); /* 可选：一点投影更立体 */
}

.change-tip {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--text-desc);
  letter-spacing: .5rpx;
}

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
  resize: none; /* 禁止拖动，防止样式穿帮 */
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