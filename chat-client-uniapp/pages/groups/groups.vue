<template>
  <image class="bg-image" src="/static/background/session.jpg" mode="aspectFill"/>
  <view class="page">
    <view class="function-list">

    <view class="function-item" @click="gotoCreateGroup">
      <image class="icon" src="/static/icons/create-group.png"></image>
      <text class="label">创建群组</text>
    </view>

      <view class="function-item" @click="gotoJoinGroup">
        <image class="icon" src="/static/icons/join-group.png"></image>
        <text class="label">加入群聊</text>
      </view>

      <view class="function-item" @click="gotoGroupRequest">
        <image class="icon" src="/static/icons/group-applicants.png"></image>
        <text class="label">群聊用户申请</text>
      </view>

    </view>

    <view v-if="list.length === 0" class="empty">暂无群聊</view>

    <view
        v-for="(item, idx) in list"
        :key="idx"
        class="list-item"
        @click="connect(item)"
    >
      <image class="avatar" :src="item.avatar || defaultGroupAvatar"></image>
      <view class="content">
        <text class="name">{{ item.groupName }}</text>
      </view>

    </view>
  </view>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {

  computed: {
    ...mapState('groups', ['list']),   // 直接读全局 list
    defaultGroupAvatar() {
      return '/static/default-avatar/xianluomao.png'
    }
  },
  methods: {
    ...mapActions('groups', ['loadGroups']),

    gotoCreateGroup(){
      uni.navigateTo({url: "/pages/create-group/create-group"})
    },
    gotoJoinGroup(){
      uni.navigateTo({url: "/pages/join-group/join-group"})
    },
    gotoGroupRequest(){
      uni.navigateTo({url: "/pages/group-requests/group-requests"})
    },
    // 点击会话进入聊天
    connect(item) {
      let query = ''
      if (item.groupId) {
        query = `?targetId=${item.groupId}&type=group`
        uni.navigateTo({
          url: '/pages/chat/chat' + query
        })
      }
    }
  },
  onShow() {
    this.loadGroups()   // 兜底：切回来就拉一次
  }
}
</script>

<style lang="scss" scoped>
/* ================ 视觉变量 ================ */
:root {
--theme: #07c160;
--bg: #f7f8fc;
--card: #ffffff;
--radius: 24rpx;
--shadow: 0 8rpx 30rpx rgba(0, 0, 0, .06);
--text-title: #1f2937;
--text-desc: #6b7280;
--ease: cubic-bezier(.4, .8, .2, 1);
}

/* ================ 背景图 ================ */
.bg-image {
position: fixed;
left: 0;
top: 0;
width: 100%;
height: 100%;
z-index: -1;
}

/* ================ 页面骨架 ================ */
.page {
background: transparent;
min-height: 100vh;
padding: 40rpx;
box-sizing: border-box;
}

/* ================ 功能卡片 ================ */
.function-list {
background: var(--card);
border-radius: var(--radius);
box-shadow: var(--shadow);
overflow: hidden;
margin-bottom: 30rpx;
}

.function-item {
display: flex;
align-items: center;
padding: 30rpx;
border-bottom: 2rpx solid #f2f2f2;
transition: background-color .2s var(--ease);
}
.function-item:last-child {
border-bottom: none;
}
.function-item:active {
background-color: #f8f8f8;
}

.icon {
width: 48rpx;
height: 48rpx;
margin-right: 24rpx;
flex-shrink: 0;
}

.label {
font-size: 30rpx;
color: var(--text-title);
}

/* ================ 群聊列表 ================ */
.list-item {
display: flex;
align-items: center;
padding: 24rpx 0;
margin-bottom: 16rpx;
background: var(--card);
border-radius: var(--radius);
box-shadow: var(--shadow);
transition: transform .15s var(--ease);
}
.list-item:active {
transform: scale(.98);
}

.avatar {
width: 88rpx;
height: 88rpx;
border-radius: 50%;
margin-right: 24rpx;
flex-shrink: 0;
/* 黑边防遮挡 */
//border: 4rpx solid #000;
box-sizing: border-box;
}

.content {
flex: 1;
display: flex;
flex-direction: column;
justify-content: center;
}

.name {
font-size: 32rpx;
color: var(--text-title);
font-weight: 500;
}

/* ================ 空状态 ================ */
.empty {
margin-top: 60rpx;
text-align: center;
font-size: 28rpx;
color: var(--text-desc);
}

</style>