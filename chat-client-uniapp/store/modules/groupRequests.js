import {fetchGroupRequests} from "../../utils/socket.js";

const state = {
    list: [],
    lastUpdate: 0
}

const mutations = {
    SET_LIST(state, arr) {
        state.list = arr
        state.lastUpdate = Date.now()
    },
    // 幂等：存在更新，不存在 push
    ADD_ONE(state, req) {
        const idx = state.list.findIndex(r => r.fromUser === req.fromUser && r.groupId === req.groupId)
        idx === -1 ? state.list.push(req) : state.list.splice(idx, 1, req)
    }
}

const actions = {
    async loadList({ commit, state }, { userId, force = false } = {}) {
        if (!force && Date.now() - state.lastUpdate < 5 * 60 * 1000) return
        const res = await new Promise(resolve => fetchGroupRequests(resolve))
        commit('SET_LIST', res.requests || [])
    },
    // 被 App.vue 网关调用
    addRequest({ commit }, req) {
        commit('ADD_ONE', req)
    }
}

export default { namespaced: true, state, mutations, actions }