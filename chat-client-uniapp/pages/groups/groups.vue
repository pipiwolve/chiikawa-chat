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

    <view v-if="groups.length === 0" class="empty">暂无群聊</view>

    <view
        v-for="(item, idx) in groups"
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
import { fetchGroups, registerCmdHandler, unregisterCmdHandler, setJoinGroupHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      groups: [],
      defaultGroupAvatar: "/static/default-avatar/hashiqi.png"
    }
  },
  onLoad() {
    this.loadGroups()

    // 监听事件：在其它页面触发 uni.$emit("refreshGroups") 时刷新
    uni.$on("refreshGroups", this.loadGroups)

    // 群聊相关的服务端推送
    registerCmdHandler(203, (data) => {
      uni.showToast({ title: `群聊 ${data.groupName} 创建成功`, icon: "success" })
      uni.$emit("refreshGroups")
    })

    registerCmdHandler(204, (data) => {
      uni.showToast({ title: `你已加入群聊 ${data.groupName}`, icon: "success" })
      uni.$emit("refreshGroups")
    })

    // 监听加入申请通知或同意
    setJoinGroupHandler((msg) => {
      if (msg.cmd === 214) {
        uni.showToast({ title: `收到新加入群申请`, icon: "none" });
        // 可选：显示在群聊申请列表
      } else if (msg.cmd === 210) {
        uni.showToast({ title: `群聊列表已更新`, icon: "success" });
        uni.$emit("refreshGroups");
      }
    });

  },
  onUnload() {
    // 避免事件重复绑定
    uni.$off("refreshGroups", this.loadGroups)

    // 注销 WebSocket 回调
    unregisterCmdHandler(212) // 群聊列表查询
    unregisterCmdHandler(203) // 创建群成功
    unregisterCmdHandler(204) // 被拉入群

    unregisterCmdHandler(214);//发送好友申请
    unregisterCmdHandler(210); //加入群聊成功
  },
  methods: {
    loadGroups() {
      fetchGroups((res) => {
        console.log("[Groups] 收到群聊列表:", res)
        if (res.groups) {
          this.groups = res.groups
        }
      })
    },

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