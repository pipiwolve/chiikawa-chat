<template>
  <image class="bg-image" src="/static/background/friends_bg.png" mode="aspectFill"/>
  <view class="page">

    <!-- 功能入口 -->
    <view class="function-list">
      <!-- 好友申请 -->
      <view class="function-item" @click="gotoFriendRequests">
        <image class="icon" src="/static/icons/friend-request.png"></image>
        <text class="label">新好友</text>
      </view>

      <!-- 群聊联系人 -->
      <view class="function-item" @click="gotoGroups">
        <image class="icon" src="/static/icons/groups.png"></image>
        <text class="label">群聊联系人</text>
      </view>

      <!-- 联系人操作（比如添加/搜索好友） -->
      <view class="function-item" @click="openMenu">
        <image class="icon" src="/static/icons/contact-op.png"></image>
        <text class="label">联系人操作</text>
      </view>
    </view>


    <view v-for="(item, index) in friends" :key="index" class="list-item" @click="connect(item)">
      <image class="avatar" :src="item.avatar || defaultAvatar"></image>
      <text class="nickname">{{ item.username }}</text>
    </view>
  </view>
</template>

<script>
import { fetchFriends, registerCmdHandler, unregisterCmdHandler } from '@/utils/socket.js'

export default {
  data() {
    return {
      friends: [],
      defaultAvatar: '/static/default-avatar/xianluomao.png',
    }
  },
  onLoad() {
    this.loadFriends()
    uni.$on("refreshFriends", this.loadFriends)

    registerCmdHandler(207, (data) => {
      // 只有非自己发起的通知才显示 Toast
      if (data.friendId !== this.userId) {
        uni.showToast({title: `你和 ${data.friendId} 已成为好友`, icon: "success"})
      }
      uni.$emit("refreshFriends")
    })
  },

  onUnload() {
    uni.$off("refreshFriends", this.loadFriends) // 避免重复绑定

    unregisterCmdHandler(200)
    unregisterCmdHandler(207)


  },


  methods: {
    loadFriends() {
      fetchFriends((res) => {
        console.log("[Friends] 收到好友列表:", res)
        if (res.friends) {
          this.friends = res.friends
        }
      })
    },

    // 打开 + 菜单
    openMenu() {
      uni.showActionSheet({
        itemList: ['添加好友', '加入群聊', '创建群聊'],
        success: (res) => {
          if (res.tapIndex === 0) {
            uni.navigateTo({ url: `/pages/add-friend/add-friend?userId=${this.userId}` })
          } else if (res.tapIndex === 1) {
            uni.navigateTo({ url: `/pages/join-group/join-group?userId=${this.userId}` })
          } else if (res.tapIndex === 2) {
            uni.navigateTo({ url: `/pages/create-group/create-group?userId=${this.userId}` })
          }
        }
      })
    },
    // 点击会话进入聊天
    connect(item) {
      let query = ''
      if (item.userId) {
        query = `?targetId=${item.userId}&type=private`
        uni.navigateTo({
          url: '/pages/chat/chat' + query
        })
      }
    },

    gotoFriendRequests() {
      uni.navigateTo({ url: "/pages/friends-request/friends-request" })
    },
    gotoGroups() {
      uni.navigateTo({ url: "/pages/groups/groups" })
    }
  }
}

</script>

<style scoped>
.bg-image {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

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
.nickname { font-size: 30rpx; font-weight: 600; }

</style>