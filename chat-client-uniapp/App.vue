<script>
import { registerCmdHandler } from '@/utils/socket.js'
import store from '@/store/index.js'
	export default {
		onLaunch: function() {
			console.warn('当前组件仅支持 uni_modules 目录结构 ，请升级 HBuilderX 到 3.1.0 版本以上！')
			console.log('App Launch')

      /* ----- 好友申请（全局）----- */
      registerCmdHandler(205, (data) => {
        uni.showToast({ title: `收到${data.fromUser}的好友申请`, icon: 'none' })
        store.dispatch('friendRequests/addRequest', {
          fromUser: data.fromUser,
          username: data.username || data.fromUser,
          avatar: data.avatar || '',
          message: data.message || `${data.fromUser} 想加你为好友`
        })
      })

      // 206 同意成功
      registerCmdHandler(206, () => {
        uni.showToast({ title: '你已同意好友申请', icon: 'none' })
        store.dispatch('friends/loadFriends', true)   // 强制刷新
        store.dispatch('sessions/loadList', true)
      })

      registerCmdHandler(207, (data) => {
        store.dispatch('friends/loadFriends', true)   // 强制刷新
        // Toast 只在「非自己发起」时弹
        if (data.friendId !== uni.getStorageSync('currentUserId')) {
          uni.showToast({title: `你和 ${data.userId} 已成为好友`, icon: 'none'})
        }
      })

      /* ----- 群聊相关 ----- */
      registerCmdHandler(210, (data) => {
        uni.showToast({ title: '群聊列表已更新', icon: 'none' })
        store.dispatch('groups/loadGroups', true)   // 强制刷新
      })
      // // 被拉入群、创建群成功也统一走 210（后端保证推送同一 cmd）
      // // 群聊相关的服务端推送
      // registerCmdHandler(203, (data) => {
      //   uni.showToast({ title: `群聊 ${data.groupName} 创建成功`, icon: `none` })
      //   store.dispatch('groups/loadGroups', true)
      //   store.dispatch('sessions/loadList', true)   // ✅ 刷新消息中心
      // })

      registerCmdHandler(204, (data) => {
        uni.showToast({ title: `你已加入群聊 ${data.groupName}`, icon: `none` })
        store.dispatch('groups/loadGroups', true)
        store.dispatch('sessions/loadList', true)
      })

      /* ----- 群聊新申请（全局）----- */
      registerCmdHandler(218, (msg) => {
        uni.showToast({ title: `收到${msg.fromUser}群聊申请`, icon: 'none' })
        store.dispatch('groupRequests/addRequest', msg)   // 直接塞进列表
        store.dispatch('groupRequests/loadList', true)    // 可选：全量兜底
      })


		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import '@/uni_modules/uni-scss/index.scss';
	/* #ifndef APP-NVUE */
	@import '@/static/customicons.css';
	// 设置整个项目的背景色
	page {
		background-color: #f5f5f5;
	}

	/* #endif */
	.example-info {
		font-size: 14px;
		color: #333;
		padding: 10px;
	}
</style>
