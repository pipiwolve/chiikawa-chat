<template>
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

<style scoped>
.page {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}
.function-list {
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
}
.function-item {
  display: flex;
  align-items: center;
  padding: 24rpx 20rpx;
  border-bottom: 1px solid #eee;
}
.function-item:last-child {
  border-bottom: none;
}
.icon {
  width: 48rpx;
  height: 48rpx;
  margin-right: 20rpx;
}
.label {
  font-size: 30rpx;
}
.list-item { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1px solid #f5f5f5; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 12rpx; margin-right: 20rpx; }
.name { font-size: 30rpx; font-weight: 600; }
</style>