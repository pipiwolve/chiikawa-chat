import {fetchFriendRequests, respondFriendRequest} from "../../utils/socket.js";

const state = {
    list: [],        // 未处理申请数组
    lastUpdate: 0
}

const mutations = {
    SET_LIST(state, arr) {
        state.list = arr
        state.lastUpdate = Date.now()
    },
    // 幂等：存在更新，不存在 unshift 到最前面（时间倒序）
    ADD_ONE(state, req) {
        const idx = state.list.findIndex(r => r.fromUser === req.fromUser)
        idx === -1 ? state.list.unshift(req) : state.list.splice(idx, 1, req)
    },
    REMOVE_ONE(state, fromUser) {
        state.list = state.list.filter(r => r.fromUser !== fromUser)
    }
}

const actions = {
    async loadList({ commit, state }, { userId, force = false } = {}) {
        if (!force && Date.now() - state.lastUpdate < 5 * 60 * 1000) return
        const res = await new Promise(resolve => fetchFriendRequests(resolve))
        commit('SET_LIST', res.requests || [])
    },
    // 被 App.vue 网关调用
    addRequest({ commit }, req) {
        commit('ADD_ONE', req)
    },
    // 页面点击「同意」后调用
    async agree({ commit }, { fromUser, userId }) {
        commit('REMOVE_ONE', fromUser)                 // 乐观删除
        // 直接向后端发字符串
        respondFriendRequest(fromUser, userId, 'accept')
    }
}

export default { namespaced: true, state, mutations, actions }